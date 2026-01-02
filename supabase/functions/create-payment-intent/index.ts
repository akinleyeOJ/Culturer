// Supabase Edge Function: create-payment-intent
// This function creates a Stripe Payment Intent to charge a customer

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { amount, currency, paymentMethodId, customerId, orderId, metadata } = await req.json()

        // Validate required fields
        if (!amount || !currency) {
            throw new Error('Missing required fields: amount and currency')
        }

        // Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency.toLowerCase(),
            payment_method: paymentMethodId,
            customer: customerId,
            confirm: paymentMethodId ? true : false, // Auto-confirm if payment method provided
            automatic_payment_methods: paymentMethodId ? undefined : {
                enabled: true,
            },
            metadata: {
                orderId: orderId || '',
                ...metadata,
            },
        })

        return new Response(
            JSON.stringify({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
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
                status: 400,
            }
        )
    }
})
