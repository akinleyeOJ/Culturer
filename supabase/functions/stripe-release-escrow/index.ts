// Supabase Edge Function: stripe-release-escrow
// ----------------------------------------------
// Releases an order's escrowed funds to the seller's connected account.
//
// Triggered by:
//   1. Buyer tapping "I got my item" in app/profile/confirm-delivery/[id].tsx
//   2. A scheduled job after ESCROW_AUTO_RELEASE_DAYS since delivered_at
//
// Flow:
//   1. Load order + seller's stripe_connect_account_id
//   2. Guard: order.status must be 'delivered' (or buyer confirmed)
//            order.escrow_status must be 'held'
//   3. stripe.paymentIntents.capture   (if not already captured)
//   4. stripe.transfers.create -> seller's connected account
//            amount = total - platform_fee
//   5. Update orders.escrow_status = 'released', stripe_transfer_id
//
// Request body: { order_id: string, trigger: 'buyer_confirmed' | 'auto_release' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import {
    corsHeaders,
    errorResponse,
    successResponse,
} from '../_shared/furgonetka.ts'
import { getSupabaseAdmin, getSupabaseUserClient } from '../_shared/supabaseAdmin.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const PLATFORM_FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') || '5')

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const orderId = String(body?.order_id || '').trim()
        const trigger = String(body?.trigger || 'auto_release')
        if (!orderId) {
            return errorResponse('order_id is required')
        }

        const admin = getSupabaseAdmin()
        const authHeader = req.headers.get('Authorization') || ''
        const isServiceRole =
            authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`

        if (trigger === 'buyer_confirmed') {
            if (!authHeader.startsWith('Bearer ')) {
                return errorResponse('Missing authorization', 401)
            }
            const userClient = getSupabaseUserClient(authHeader)
            const { data: userData } = await userClient.auth.getUser()
            if (!userData?.user?.id) {
                return errorResponse('Invalid session', 401)
            }
            const { data: order } = await admin
                .from('orders')
                .select('user_id')
                .eq('id', orderId)
                .single()
            if (!order || order.user_id !== userData.user.id) {
                return errorResponse('Forbidden', 403)
            }
        } else if (!isServiceRole) {
            return errorResponse('Auto-release requires service role', 401)
        }

        void stripe
        void PLATFORM_FEE_PERCENT

        // TODO(phase-6): capture PI, create Transfer, update orders row.
        return successResponse({
            stub: true,
            message: 'stripe-release-escrow not yet implemented (Phase 6)',
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('stripe-release-escrow error:', message)
        return errorResponse(message)
    }
})
