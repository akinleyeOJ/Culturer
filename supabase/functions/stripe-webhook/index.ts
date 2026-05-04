// Supabase Edge Function: stripe-webhook
// Handles asynchronous events from Stripe (e.g., successful payments)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Stripe Webhook function up and running!')

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

// Initialize Secret for verification
// user MUST set this in Supabase Secrets
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

/**
 * After payment is confirmed, ask `furgonetka-create-shipment` to print a label (Phase 4)
 * or validate the order (stub). Idempotent: skips local pickup and if `shipments` already exists.
 * Uses service role — same as future stripe-webhook automation.
 */
async function maybeInvokeFurgonetkaCreateShipment(
    supabaseAdmin: ReturnType<typeof createClient>,
    orderId: string,
): Promise<void> {
    const { data: existingShipment } = await supabaseAdmin
        .from('shipments')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle()

    if (existingShipment) {
        console.log(`furgonetka-create-shipment skipped: shipment already exists for order ${orderId}`)
        return
    }

    const { data: orderRow } = await supabaseAdmin
        .from('orders')
        .select('shipping_method_details')
        .eq('id', orderId)
        .maybeSingle()

    const raw = orderRow?.shipping_method_details
    const details =
        raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {}
    const shipType = String(details.type || '').toLowerCase()
    if (shipType === 'local_pickup') {
        console.log(`furgonetka-create-shipment skipped: local_pickup for order ${orderId}`)
        return
    }

    const baseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!baseUrl || !serviceKey) {
        console.error(
            'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot invoke furgonetka-create-shipment',
        )
        return
    }

    const url = `${baseUrl}/functions/v1/furgonetka-create-shipment`
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
    })

    const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        stub?: boolean
    }
    if (!res.ok || !json?.success) {
        const msg = typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`
        console.error(`furgonetka-create-shipment failed for order ${orderId}:`, msg, json)
        throw new Error(msg)
    }
    console.log(
        `furgonetka-create-shipment ok for order ${orderId}${json.stub === true ? ' (stub)' : ''}`,
    )
}

serve(async (req) => {
    // 1. Verify Request Signature (Security Critical)
    const signature = req.headers.get('Stripe-Signature')

    if (!signature || !endpointSecret) {
        return new Response('Webhook Error: Missing signature or secret', { status: 400 })
    }

    let event
    try {
        const body = await req.text() // Read raw body
        event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
    } catch (err: any) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    // 2. Handle Event
    console.log(`Processing event: ${event.type}`)

    // Initialize Supabase Admin Client (to bypass RLS)
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Shared helper: decrement stock once per order.
    const decrementStock = async (orderId: string) => {
        try {
            const { data: orderItems, error: itemsError } = await supabaseAdmin
                .from('order_items')
                .select('product_id, quantity')
                .eq('order_id', orderId)

            if (itemsError || !orderItems) return

            for (const item of orderItems) {
                const { data: product } = await supabaseAdmin
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', item.product_id)
                    .single()

                if (product) {
                    const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity)
                    await supabaseAdmin
                        .from('products')
                        .update({
                            stock_quantity: newStock,
                            in_stock: newStock > 0,
                            out_of_stock: newStock <= 0,
                        })
                        .eq('id', item.product_id)
                }
            }
        } catch (stockErr) {
            console.error('Error updating stock in webhook:', stockErr)
        }
    }

    try {
        switch (event.type) {
            // Manual-capture escrow flow: funds authorised but not captured yet.
            // This is the signal that the buyer's card was charged successfully
            // and we can now create the shipment label.
            case 'payment_intent.amount_capturable_updated': {
                const paymentIntent = event.data.object
                const orderId = paymentIntent.metadata?.orderId

                if (orderId) {
                    console.log(`Payment authorised (escrow pending) for Order ID: ${orderId}`)

                    const { error } = await supabaseAdmin
                        .from('orders')
                        .update({
                            status: 'paid',
                            escrow_status: 'pending',
                            payment_method: 'stripe',
                            stripe_payment_intent_id: paymentIntent.id,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', orderId)

                    if (error) throw error

                    await decrementStock(orderId)

                    try {
                        await maybeInvokeFurgonetkaCreateShipment(supabaseAdmin, orderId)
                    } catch (labelErr: unknown) {
                        // Do not fail the webhook — avoids Stripe retries re-running decrementStock.
                        console.error('furgonetka-create-shipment after authorisation:', labelErr)
                    }
                }
                break
            }

            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object
                const orderId = paymentIntent.metadata?.orderId

                if (orderId) {
                    const isCaptureOfEscrow = paymentIntent.capture_method === 'manual'
                    console.log(
                        `Payment succeeded for Order ID: ${orderId} (escrow capture: ${isCaptureOfEscrow})`,
                    )

                    const patch: Record<string, unknown> = {
                        payment_method: 'stripe',
                        updated_at: new Date().toISOString(),
                    }

                    if (isCaptureOfEscrow) {
                        // Funds captured = escrow released to seller.
                        patch.escrow_status = 'released'
                        if (paymentIntent.latest_charge) {
                            patch.stripe_transfer_id =
                                typeof paymentIntent.latest_charge === 'string'
                                    ? paymentIntent.latest_charge
                                    : paymentIntent.latest_charge.id
                        }
                    } else {
                        // Legacy direct-charge path (system-seller fallback).
                        patch.status = 'paid'
                        patch.escrow_status = 'released'
                        await decrementStock(orderId)
                    }

                    const { error } = await supabaseAdmin
                        .from('orders')
                        .update(patch)
                        .eq('id', orderId)

                    if (error) throw error

                    if (!isCaptureOfEscrow) {
                        try {
                            await maybeInvokeFurgonetkaCreateShipment(supabaseAdmin, orderId)
                        } catch (labelErr: unknown) {
                            console.error(
                                'furgonetka-create-shipment after direct charge:',
                                labelErr,
                            )
                        }
                    }
                }
                break
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object
                const orderId = paymentIntent.metadata.orderId
                const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown error'

                if (orderId) {
                    console.log(`Payment failed for Order ID: ${orderId}`)

                    // Update Order Status to 'cancelled'
                    const { error } = await supabaseAdmin
                        .from('orders')
                        .update({
                            status: 'cancelled',
                            notes: `Payment failed: ${errorMessage}`,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', orderId)

                    if (error) throw error
                }
                break
            }

            default:
                console.log(`Unhandled event type ${event.type}`)
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (err: any) {
        console.error('Error processing webhook:', err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
