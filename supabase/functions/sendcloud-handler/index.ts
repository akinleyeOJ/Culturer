import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SENDCLOUD_PUBLIC_KEY = Deno.env.get('SENDCLOUD_PUBLIC_KEY') || ''
const SENDCLOUD_SECRET_KEY = Deno.env.get('SENDCLOUD_SECRET_KEY') || ''
const SENDCLOUD_SERVICE_POINTS_API_URL = 'https://servicepoints.sendcloud.sc/api/v2/service-points'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVIDER_CARRIER_CODES: Record<string, string[]> = {
    'colissimo pickup': ['colissimo', 'la_poste'],
    'correos pickup': ['correos'],
    'dhl packstation': ['dhl'],
    'dhl servicepoint / locker': ['dhl'],
    'dpd pickup': ['dpd'],
    'evri parcelshop': ['evri', 'hermes'],
    'gls parcelshop': ['gls'],
    'hermes paketshop': ['hermes'],
    'inpost locker 24/7': ['inpost'],
    'mondial relay': ['mondial_relay', 'mondialrelay'],
    'poczta polska pickup': ['poczta_polska', 'pocztex'],
    'postnl pickup point': ['postnl'],
    'poste italiane punto poste': ['poste_italiane', 'posteitaliane'],
    'postnord pickup point': ['postnord'],
    'seur pickup': ['seur'],
    'ups access point': ['ups'],
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
    austria: 'AT',
    belgium: 'BE',
    bulgaria: 'BG',
    croatia: 'HR',
    cyprus: 'CY',
    'czech republic': 'CZ',
    denmark: 'DK',
    estonia: 'EE',
    finland: 'FI',
    france: 'FR',
    germany: 'DE',
    greece: 'GR',
    hungary: 'HU',
    ireland: 'IE',
    italy: 'IT',
    latvia: 'LV',
    lithuania: 'LT',
    luxembourg: 'LU',
    malta: 'MT',
    netherlands: 'NL',
    poland: 'PL',
    portugal: 'PT',
    romania: 'RO',
    slovakia: 'SK',
    slovenia: 'SI',
    spain: 'ES',
    sweden: 'SE',
    'united kingdom': 'GB',
}

const normalize = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const normalizeCountryCode = (country: string) => {
    const trimmed = country.trim()
    if (trimmed.length === 2) {
        return trimmed.toUpperCase()
    }

    return COUNTRY_NAME_TO_CODE[normalize(country)] || trimmed.toUpperCase()
}

const buildAuthHeader = () => {
    const encoded = btoa(`${SENDCLOUD_PUBLIC_KEY}:${SENDCLOUD_SECRET_KEY}`)
    return `Basic ${encoded}`
}

const matchesCarrier = (carrierName: string, payload: any) => {
    const normalizedCarrierName = normalize(carrierName)
    const expectedCodes = PROVIDER_CARRIER_CODES[normalizedCarrierName] || []
    const candidateValues = [
        payload?.carrier,
        payload?.name,
        payload?.shop_type,
        payload?.extra_data?.partner_name,
    ]
        .filter(Boolean)
        .map((value) => normalize(String(value)))

    if (expectedCodes.length === 0) {
        return candidateValues.some((value) => value.includes(normalizedCarrierName))
    }

    return candidateValues.some((value) =>
        expectedCodes.some((code) => value.includes(normalize(code)))
    )
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        if (!SENDCLOUD_PUBLIC_KEY || !SENDCLOUD_SECRET_KEY) {
            throw new Error('Sendcloud credentials are not configured')
        }

        const { action, ...data } = await req.json()

        if (action !== 'list-service-points') {
            throw new Error(`Invalid action: ${action}`)
        }

        const country = normalizeCountryCode(data.country || '')
        const address = (data.address || '').trim()
        const radius = Number(data.radius) || 15000

        if (!country || !address) {
            throw new Error('Missing required fields: country and address')
        }

        const url = new URL(SENDCLOUD_SERVICE_POINTS_API_URL)
        url.searchParams.set('country', country)
        url.searchParams.set('address', address)
        url.searchParams.set('radius', String(radius))

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': buildAuthHeader(),
            },
        })

        const payload = await response.json()

        if (!response.ok) {
            throw new Error(payload?.message || payload?.error || 'Failed to fetch service points')
        }

        const rawServicePoints = Array.isArray(payload?.service_points)
            ? payload.service_points
            : Array.isArray(payload)
                ? payload
                : []

        const filtered = rawServicePoints.filter((servicePoint: any) =>
            matchesCarrier(data.carrier_name || '', servicePoint)
        )

        const servicePoints = filtered.map((servicePoint: any) => ({
            id: String(servicePoint.id),
            name: servicePoint.name || servicePoint.code || String(servicePoint.id),
            carrier: servicePoint.carrier || '',
            address: [
                [servicePoint.postal_code, servicePoint.city].filter(Boolean).join(' '),
                [servicePoint.street, servicePoint.house_number].filter(Boolean).join(' '),
            ]
                .filter(Boolean)
                .join(', '),
            hint: servicePoint.extra_data?.partner_name || servicePoint.name || servicePoint.carrier || '',
            latitude: servicePoint.latitude ? Number(servicePoint.latitude) : undefined,
            longitude: servicePoint.longitude ? Number(servicePoint.longitude) : undefined,
        }))

        return new Response(
            JSON.stringify({ success: true, service_points: servicePoints }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error: any) {
        console.error('Sendcloud handler error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
