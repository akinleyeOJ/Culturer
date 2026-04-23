// Supabase Edge Function: furgonetka-webhook
// -------------------------------------------
// Receives scan events from Furgonetka's webhook system.
// Registered URL in Furgonetka dashboard:
//   https://<project>.functions.supabase.co/furgonetka-webhook
//
// Responsibilities:
//   1. Verify HMAC signature using FURGONETKA_WEBHOOK_SECRET
//   2. Look up shipment by tracking_number or furgonetka_shipment_id
//   3. Insert a row in `tracking_events`
//   4. Update `shipments.status` to the latest event
//   5. If status === 'delivered', set orders.delivered_at and
//      let the escrow auto-release job pick it up later.
//
// Supabase Realtime broadcasts the tracking_events INSERT to any
// subscribed buyer/seller client.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
    corsHeaders,
    errorResponse,
    successResponse,
} from '../_shared/furgonetka.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

const FURGONETKA_WEBHOOK_SECRET = Deno.env.get('FURGONETKA_WEBHOOK_SECRET') || ''

const timingSafeEqual = (a: string, b: string) => {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

const verifySignature = async (raw: string, signature: string): Promise<boolean> => {
    if (!FURGONETKA_WEBHOOK_SECRET) {
        console.warn('FURGONETKA_WEBHOOK_SECRET not set — refusing webhook in production mode')
        return false
    }
    const keyData = new TextEncoder().encode(FURGONETKA_WEBHOOK_SECRET)
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(raw))
    const expected = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    return timingSafeEqual(expected, signature.toLowerCase())
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const raw = await req.text()
        const signature =
            req.headers.get('X-Furgonetka-Signature') ||
            req.headers.get('x-furgonetka-signature') ||
            ''

        if (FURGONETKA_WEBHOOK_SECRET && !(await verifySignature(raw, signature))) {
            return errorResponse('Invalid webhook signature', 401)
        }

        const event = JSON.parse(raw || '{}')

        // TODO(phase-5): map Furgonetka event -> tracking_events row.
        // Expected minimum fields on `event`:
        //   tracking_number, status, description, location, timestamp
        console.log('furgonetka-webhook received event:', event?.type || 'unknown')

        const admin = getSupabaseAdmin()
        void admin // keep import until Phase 5 implementation lands

        return successResponse({ received: true })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('furgonetka-webhook error:', message)
        return errorResponse(message)
    }
})
