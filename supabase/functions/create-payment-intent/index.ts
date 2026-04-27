// Supabase Edge Function: create-payment-intent
// -----------------------------------------------
// Buyer checkout payment creation.
//
// Changes from the pre-Furgonetka version:
//   * `capture_method: 'manual'`  -> funds are *authorised* on the buyer's
//     card but not captured; stripe-release-escrow captures later (on
//     delivery + cooldown, or on buyer confirmation).
//   * `transfer_data.destination` -> seller's Stripe Connect Express account.
//   * `application_fee_amount`    -> Culturer platform cut (PLATFORM_FEE_PERCENT).
//   * Writes `stripe_payment_intent_id` + `escrow_status='pending'` on the order.
//
// If the seller is not onboarded to Connect yet, the PI is rejected with a
// clear error so the UI can prompt the buyer to try again later (and
// notify the seller to complete onboarding).
//
// System seller ("system" fallback for platform-owned inventory) keeps the
// legacy direct-charge behaviour (no transfer_data, no manual capture).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const PLATFORM_FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') || '5')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderRow {
    id: string
    seller_id: string | null
    total_amount: number | null
}

interface SellerProfileRow {
    id: string
    stripe_connect_account_id: string | null
    stripe_connect_onboarded: boolean | null
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const {
            amount,
            currency,
            paymentMethodId,
            userId,
            email,
            saveCard,
            orderId,
            metadata,
        } = await req.json()

        if (!amount || !currency) {
            throw new Error('Missing required fields: amount and currency')
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // ----- 1. Stripe Customer on buyer profile (unchanged) -----
        let stripeCustomerId: string | null = null
        if (userId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single<{ stripe_customer_id: string | null }>()

            if (profile?.stripe_customer_id) {
                stripeCustomerId = profile.stripe_customer_id
            } else {
                const customer = await stripe.customers.create({
                    email,
                    metadata: { supabase_uid: userId },
                })
                stripeCustomerId = customer.id
                await supabaseAdmin
                    .from('profiles')
                    .update({ stripe_customer_id: stripeCustomerId })
                    .eq('id', userId)
            }
        }

        // ----- 2. Resolve seller + Connect account for escrow -----
        let sellerConnectAccountId: string | null = null
        let sellerIdForMetadata: string | null = null

        if (orderId) {
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('id, seller_id, total_amount')
                .eq('id', orderId)
                .single<OrderRow>()

            if (!order) {
                throw new Error(`Order not found: ${orderId}`)
            }

            const sellerId = String(order.seller_id || '').trim()
            sellerIdForMetadata = sellerId

            const isSystemSeller =
                !sellerId ||
                sellerId === 'system' ||
                !/^[0-9a-fA-F-]{36}$/.test(sellerId)

            if (!isSystemSeller) {
                const { data: sellerProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, stripe_connect_account_id, stripe_connect_onboarded')
                    .eq('id', sellerId)
                    .single<SellerProfileRow>()

                if (!sellerProfile?.stripe_connect_account_id || !sellerProfile?.stripe_connect_onboarded) {
                    throw new Error(
                        'Seller has not completed Stripe payout onboarding yet. Please try again shortly.',
                    )
                }

                sellerConnectAccountId = sellerProfile.stripe_connect_account_id
            }
        }

        // ----- 3. Build PaymentIntent options -----
        const amountMinor = Math.round(Number(amount) * 100)
        const applicationFee = sellerConnectAccountId
            ? Math.round((amountMinor * PLATFORM_FEE_PERCENT) / 100)
            : 0

        const options: Stripe.PaymentIntentCreateParams = {
            amount: amountMinor,
            currency: String(currency).toLowerCase(),
            payment_method: paymentMethodId,
            receipt_email: email,
            confirm: Boolean(paymentMethodId),
            return_url: 'culturar://checkout/complete',
            metadata: {
                orderId: orderId || '',
                sellerId: sellerIdForMetadata || '',
                ...(metadata || {}),
            },
        }

        if (sellerConnectAccountId) {
            options.capture_method = 'manual'
            options.transfer_data = { destination: sellerConnectAccountId }
            options.application_fee_amount = applicationFee
        }

        if (stripeCustomerId) {
            options.customer = stripeCustomerId
            if (saveCard && paymentMethodId) {
                options.setup_future_usage = 'off_session'
            }
        }

        // ----- 4. Create PaymentIntent -----
        const paymentIntent = await stripe.paymentIntents.create(options)

        // ----- 5. Persist PI + escrow bookkeeping on the order -----
        if (orderId) {
            const orderPatch: Record<string, unknown> = {
                stripe_payment_intent_id: paymentIntent.id,
                payment_intent_id: paymentIntent.id,
            }

            // Manual-capture flow: authorised-only status, funds not yet taken.
            // Legacy system-seller flow: funds captured immediately on success.
            if (sellerConnectAccountId) {
                orderPatch.escrow_status = 'pending'
            } else if (paymentIntent.status === 'succeeded') {
                orderPatch.status = 'paid'
                orderPatch.escrow_status = 'released'
            }

            await supabaseAdmin.from('orders').update(orderPatch).eq('id', orderId)
        }

        return new Response(
            JSON.stringify({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                customerId: stripeCustomerId,
                escrow: Boolean(sellerConnectAccountId),
                platformFeePercent: sellerConnectAccountId ? PLATFORM_FEE_PERCENT : 0,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error creating payment intent:', message)
        return new Response(
            JSON.stringify({ success: false, error: message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
    }
})
