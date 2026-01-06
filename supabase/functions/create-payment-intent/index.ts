// Supabase Edge Function: create-payment-intent
// Handles Payment Intent creation + Stripe Customer management (Save Card)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Create Payment Intent function started')

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
            userId,           // Supabase User ID
            email,            // User Email
            saveCard,         // Boolean: save for future?
            orderId,
            metadata
        } = await req.json()

        if (!amount || !currency) {
            throw new Error('Missing required fields: amount and currency')
        }

        // Initialize Supabase Admin (Service Role) to manage Profiles
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let stripeCustomerId = null

        // 1. Manage Stripe Customer (Only if we have a User ID)
        if (userId) {
            // Check if user already has a Stripe ID
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single()

            if (profile?.stripe_customer_id) {
                stripeCustomerId = profile.stripe_customer_id
            } else {
                // Create new Stripe Customer
                console.log(`Creating new Stripe Customer for user ${userId}`)
                const customer = await stripe.customers.create({
                    email: email,
                    metadata: { supabase_uid: userId }
                })
                stripeCustomerId = customer.id

                // Save to Profile
                await supabaseAdmin
                    .from('profiles')
                    .update({ stripe_customer_id: stripeCustomerId })
                    .eq('id', userId)
            }
        }

        // 2. Prepare PaymentIntent Options
        const options: any = {
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            payment_method: paymentMethodId,
            receipt_email: email, // Use validated email
            confirm: paymentMethodId ? true : false,
            return_url: 'culturar://checkout/complete',
            metadata: {
                orderId: orderId || '',
                ...metadata,
            },
        }

        // 3. Attach Customer & Save Card logic
        if (stripeCustomerId) {
            options.customer = stripeCustomerId

            if (saveCard && paymentMethodId) {
                options.setup_future_usage = 'off_session'
            }
        } else {
            // Fallback for guest checkout logic (no customer ID attached)
            // Currently our app forces login so userId should be present
        }

        // 4. Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create(options)

        return new Response(
            JSON.stringify({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                customerId: stripeCustomerId // Return for debug
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: any) {
        console.error('Error creating payment intent:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Returning 200 to expose error message to client
            }
        )
    }
})
