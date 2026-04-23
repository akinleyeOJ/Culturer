// Supabase Edge Function: furgonetka-service-points
// --------------------------------------------------
// Proxies Furgonetka's service-point search for lockers / pickup points
// (InPost Paczkomat, DPD Pickup, DHL ServicePoint, GLS ParcelShop,
// Orlen Paczka, Poczta Polska pickup).
//
// Called from `app/pickup-points.tsx` when the buyer wants to choose
// a specific locker/point for a carrier that requires one.
//
// Request body:
// {
//   carrier: 'inpost' | 'dpd' | 'dhl' | 'gls' | 'orlen' | 'poczta',
//   postcode?: string,
//   city?: string,
//   lat?: number,
//   lng?: number,
//   radius_km?: number,   // default 3
//   limit?: number        // default 30
// }
//
// Response:
// {
//   success: true,
//   points: [
//     {
//       id: 'WAW123',
//       carrier: 'inpost',
//       name: 'Paczkomat WAW123',
//       address: 'ul. Marszałkowska 1',
//       city: 'Warszawa',
//       postcode: '00-001',
//       lat: 52.23, lng: 21.01,
//       opening_hours?: '24/7',
//       type: 'locker' | 'shop' | 'post_office'
//     }
//   ]
// }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
    corsHeaders,
    errorResponse,
    successResponse,
} from '../_shared/furgonetka.ts'

const SUPPORTED_CARRIERS = new Set([
    'inpost',
    'dpd',
    'dhl',
    'gls',
    'orlen',
    'poczta',
])

interface PointSearchBody {
    carrier?: string
    postcode?: string
    city?: string
    lat?: number
    lng?: number
    radius_km?: number
    limit?: number
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const body: PointSearchBody = await req.json()
        const carrier = (body.carrier || '').toLowerCase()

        if (!SUPPORTED_CARRIERS.has(carrier)) {
            return errorResponse(`Unsupported carrier: ${carrier}`)
        }

        if (!body.postcode && !body.city && (body.lat == null || body.lng == null)) {
            return errorResponse('postcode, city, or lat/lng is required')
        }

        // TODO(phase-3): call Furgonetka /api/rest/service_points with carrier filter.
        return successResponse({ points: [], source: 'stub' })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('furgonetka-service-points error:', message)
        return errorResponse(message)
    }
})
