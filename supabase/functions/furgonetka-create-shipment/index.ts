// Supabase Edge Function: furgonetka-create-shipment
// ---------------------------------------------------
// Called after a buyer's payment_intent.succeeded (by stripe-webhook)
// or manually from the seller's order-details screen.
//
// Responsibilities:
//   1. Load order + shipping_method_details from Supabase
//   2. Verify caller is either the seller or an internal service-role call
//   3. POST to Furgonetka /api/rest/shipments with sender + receiver + parcel
//   4. Insert a row into `shipments` and update `orders.status = 'shipped'`
//   5. Return { tracking_number, label_url, qr_code_url }
//
// Request body:
// { order_id: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
    corsHeaders,
    errorResponse,
    successResponse,
} from '../_shared/furgonetka.ts'
import { getSupabaseAdmin, getSupabaseUserClient } from '../_shared/supabaseAdmin.ts'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const orderId = String(body?.order_id || '').trim()
        if (!orderId) {
            return errorResponse('order_id is required')
        }

        const authHeader = req.headers.get('Authorization') || ''
        const isServiceRole =
            authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`

        const admin = getSupabaseAdmin()

        if (!isServiceRole) {
            if (!authHeader.startsWith('Bearer ')) {
                return errorResponse('Missing authorization', 401)
            }
            const userClient = getSupabaseUserClient(authHeader)
            const { data: userData, error: userErr } = await userClient.auth.getUser()
            if (userErr || !userData?.user?.id) {
                return errorResponse('Invalid session', 401)
            }

            const { data: order } = await admin
                .from('orders')
                .select('seller_id')
                .eq('id', orderId)
                .single()

            // orders.seller_id may be TEXT (UUID string) in some schemas — compare as strings.
            if (!order || String(order.seller_id || '') !== userData.user.id) {
                return errorResponse('Forbidden', 403)
            }
        }

        // TODO(phase-4):
        //   - Load order, seller profile (origin address), buyer email
        //   - Map shipping_method_details.carrier -> Furgonetka service code
        //   - POST /api/rest/shipments
        //   - Poll for tracking_number (similar to current InPost flow)
        //   - INSERT into `shipments` + UPDATE `orders`
        return successResponse({
            stub: true,
            message: 'furgonetka-create-shipment not yet implemented (Phase 4)',
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('furgonetka-create-shipment error:', message)
        return errorResponse(message)
    }
})
