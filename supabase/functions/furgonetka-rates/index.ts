// Supabase Edge Function: furgonetka-rates
// ----------------------------------------
// Returns live shipping rates from Furgonetka for all enabled PL carriers.
// Called from the buyer's DeliveryStep in the Expo app.
//
// Request body:
// {
//   origin:      { postcode: string, country_code?: 'PL' }
//   destination: { postcode: string, country_code?: 'PL' }
//   parcel:      { weight_grams: number, tier: 'mini'|'small'|'medium'|'large' }
//   carriers?:   string[]   // optional allowlist (from seller preferences)
// }
//
// Response:
// {
//   success: true,
//   rates: [
//     {
//       carrier: 'inpost',
//       display_name: 'InPost Paczkomat',
//       service_type: 'locker_pickup' | 'home_delivery' | 'pickup_point',
//       price_pln: 16.49,
//       eta_days: [1, 2],
//       requires_service_point: true,
//       quote_id: 'furg_...'
//     }
//   ]
// }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
    corsHeaders,
    errorResponse,
    successResponse,
} from '../_shared/furgonetka.ts'

interface RateRequestBody {
    origin?: { postcode?: string; country_code?: string }
    destination?: { postcode?: string; country_code?: string }
    parcel?: { weight_grams?: number; tier?: string }
    carriers?: string[]
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const body: RateRequestBody = await req.json()

        const originPostcode = body.origin?.postcode?.trim()
        const destPostcode = body.destination?.postcode?.trim()

        if (!originPostcode || !destPostcode) {
            return errorResponse('origin and destination postcodes are required')
        }

        // TODO(phase-3): call Furgonetka /api/rest/pricing and map response.
        // For now return a placeholder empty list so the client can wire up.
        return successResponse({ rates: [], source: 'stub' })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('furgonetka-rates error:', message)
        return errorResponse(message)
    }
})
