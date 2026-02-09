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

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object
                const orderId = paymentIntent.metadata.orderId // We stored this in metadata!

                if (orderId) {
                    console.log(`Payment successful for Order ID: ${orderId}`)

                    // Update Order Status to 'confirmed'
                    const { error } = await supabaseAdmin
                        .from('orders')
                        .update({
                            status: 'confirmed',
                            payment_method: 'stripe',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', orderId)

                    if (error) throw error
                    console.log('Order confirmed in database.')

                    // --- NEW: Decrement stock levels ---
                    try {
                        const { data: orderItems, error: itemsError } = await supabaseAdmin
                            .from('order_items')
                            .select('product_id, quantity')
                            .eq('order_id', orderId)

                        if (!itemsError && orderItems) {
                            for (const item of orderItems) {
                                // Fetch current stock
                                const { data: product } = await supabaseAdmin
                                    .from('products')
                                    .select('stock_quantity')
                                    .eq('id', item.product_id)
                                    .single()

                                if (product) {
                                    const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity)
                                    await supabaseAdmin
                                        .from('products')
                                        .update({ stock_quantity: newStock })
                                        .eq('id', item.product_id)
                                    console.log(`Updated stock for ${item.product_id}: ${newStock}`)
                                }
                            }
                        }
                    } catch (stockErr) {
                        console.error('Error updating stock in webhook:', stockErr)
                    }
                }
                break;

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
