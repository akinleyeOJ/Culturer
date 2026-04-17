import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCreateShipmentFromOrder } from './createShipmentFromOrder.ts'

const INPOST_POINTS_API_ORIGIN = 'https://api-shipx-pl.easypack24.net'
const INPOST_POINTS_API_PATH = '/v1/points'
const INPOST_API_BASE_URL = 'https://api-shipx-pl.easypack24.net'
const INPOST_SHIPX_TOKEN = Deno.env.get('INPOST_SHIPX_TOKEN') || ''
const INPOST_SHIPX_ORGANIZATION_ID = Deno.env.get('INPOST_SHIPX_ORGANIZATION_ID') || ''

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normalizeUrls = (input: unknown) =>
    Array.isArray(input)
        ? input
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        : []

const isAllowedInPostUrl = (value: string) => {
    try {
        const url = new URL(value)
        return url.origin === INPOST_POINTS_API_ORIGIN && url.pathname === INPOST_POINTS_API_PATH
    } catch {
        return false
    }
}

const buildShipxHeaders = () => {
    if (!INPOST_SHIPX_TOKEN) {
        throw new Error('InPost ShipX token is not configured')
    }

    return {
        'Authorization': `Bearer ${INPOST_SHIPX_TOKEN}`,
        'Content-Type': 'application/json',
    }
}

const parcelTemplateDimensions: Record<'mini' | 'small' | 'medium' | 'large', { length: string; width: string; height: string }> = {
    mini: { length: '80', width: '380', height: '640' },
    small: { length: '80', width: '380', height: '640' },
    medium: { length: '190', width: '380', height: '640' },
    large: { length: '410', width: '380', height: '640' },
}

// Static InPost Poland rates (PLN) — used when ShipX credentials are not configured.
// Source: InPost official pricing, effective 1 March 2026.
// Locker = Paczkomat® (inpost_locker_standard)
// Courier = door-to-door delivery (inpost_courier_standard)
const INPOST_STATIC_RATES: Record<string, Record<'mini' | 'small' | 'medium' | 'large', number>> = {
    inpost_locker_standard: { mini: 16.49, small: 16.49, medium: 18.49, large: 20.49 },
    inpost_courier_standard: { mini: 19.49, small: 19.49, medium: 20.49, large: 25.49 },
}

const buildStaticRates = (shipments: any[]) =>
    shipments.map((shipment: any) => {
        const service = String(shipment?.service || 'inpost_locker_standard').toLowerCase()
        const template = String(shipment?.parcelTemplate || 'medium') as 'mini' | 'small' | 'medium' | 'large'
        const serviceRates = INPOST_STATIC_RATES[service] ?? INPOST_STATIC_RATES['inpost_locker_standard']
        const amount = serviceRates[template] ?? serviceRates['medium']
        return {
            id: String(shipment?.id || ''),
            amount,
            currency: 'PLN',
        }
    })

const normalizePostalCode = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '')
    return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : String(value || '').trim()
}

const mapShipmentToCalculatePayload = (shipment: any) => {
    const template = parcelTemplateDimensions[shipment.parcelTemplate as 'mini' | 'small' | 'medium' | 'large']
    if (!template) {
        throw new Error(`Unsupported InPost parcel template: ${shipment.parcelTemplate}`)
    }

    return {
        id: shipment.id,
        receiver: {
            email: shipment.receiver.email,
            phone: shipment.receiver.phone,
            first_name: shipment.receiver.firstName,
            last_name: shipment.receiver.lastName,
            address: {
                line1: shipment.receiver.address1,
                line2: shipment.receiver.address2 || '',
                city: shipment.receiver.city,
                post_code: normalizePostalCode(shipment.receiver.postalCode),
                country_code: shipment.receiver.countryCode || 'PL',
            },
        },
        parcels: {
            dimensions: {
                ...template,
                unit: 'mm',
            },
            weight: {
                amount: '5',
                unit: 'kg',
            },
        },
        custom_attributes: shipment.targetPoint
            ? { target_point: shipment.targetPoint }
            : undefined,
        service: shipment.service,
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { action, urls } = body

        if (action === 'create-shipment-from-order') {
            return await handleCreateShipmentFromOrder(req, body, corsHeaders)
        }

        if (action !== 'search-points' && action !== 'calculate-rates') {
            throw new Error(`Invalid action: ${action}`)
        }

        if (action === 'calculate-rates') {
            const shipments = Array.isArray(body?.shipments) ? body.shipments : []
            if (shipments.length === 0) {
                return new Response(
                    JSON.stringify({ success: true, rates: [] }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                )
            }

            // No credentials configured — return static public InPost rates.
            if (!INPOST_SHIPX_TOKEN || !INPOST_SHIPX_ORGANIZATION_ID) {
                const rates = buildStaticRates(shipments)
                return new Response(
                    JSON.stringify({ success: true, rates, source: 'static' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                )
            }

            const response = await fetch(
                `${INPOST_API_BASE_URL}/v1/organizations/${INPOST_SHIPX_ORGANIZATION_ID}/shipments/calculate`,
                {
                    method: 'POST',
                    headers: buildShipxHeaders(),
                    body: JSON.stringify({
                        shipments: shipments.map(mapShipmentToCalculatePayload),
                    }),
                }
            )

            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload?.message || payload?.error || 'Failed to calculate InPost shipment rates')
            }

            const rates = Array.isArray(payload)
                ? payload.map((item: any) => ({
                    id: String(item?.id || ''),
                    amount: item?.calculated_charge_amount != null ? Number(item.calculated_charge_amount) : null,
                    currency: 'PLN',
                    error: item?.message || item?.key || undefined,
                }))
                : []

            return new Response(
                JSON.stringify({ success: true, rates }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const allowedUrls = normalizeUrls(urls)
        if (allowedUrls.length === 0) {
            return new Response(
                JSON.stringify({ success: true, payloads: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        if (allowedUrls.length > 8) {
            throw new Error('Too many InPost search requests in one batch')
        }

        if (!allowedUrls.every(isAllowedInPostUrl)) {
            throw new Error('Invalid InPost search URL')
        }

        const payloads = await Promise.all(
            allowedUrls.map(async (url) => {
                const response = await fetch(url)
                const payload = await response.json()

                if (!response.ok) {
                    throw new Error(payload?.message || payload?.error || 'Failed to fetch InPost points')
                }

                return payload
            })
        )

        return new Response(
            JSON.stringify({ success: true, payloads }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error: any) {
        console.error('InPost handler error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }
})
