import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INPOST_API_BASE_URL = 'https://api-shipx-pl.easypack24.net'
const INPOST_SHIPX_TOKEN = Deno.env.get('INPOST_SHIPX_TOKEN') || ''
const INPOST_SHIPX_ORGANIZATION_ID = Deno.env.get('INPOST_SHIPX_ORGANIZATION_ID') || ''
const INPOST_DEFAULT_SENDER_PHONE = Deno.env.get('INPOST_DEFAULT_SENDER_PHONE') || ''

const normalizePostalCode = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '')
    return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : String(value || '').trim()
}

const digitsOnly = (value: unknown) => String(value || '').replace(/\D/g, '')

const normalizePlPhone = (raw: unknown): string => {
    let d = digitsOnly(raw)
    if (d.startsWith('48') && d.length >= 11) d = d.slice(2)
    return d.slice(0, 9)
}

const splitStreetLine = (line1: string): { street: string; building_number: string } => {
    const s = String(line1 || '').trim()
    const m = s.match(/^(.*?)[\s,]+([0-9].*)$/u)
    if (m) return { street: m[1].trim() || s, building_number: m[2].trim() || '1' }
    return { street: s || '—', building_number: '1' }
}

const buildShipxHeaders = () => {
    if (!INPOST_SHIPX_TOKEN) {
        throw new Error('InPost ShipX token is not configured')
    }
    return {
        Authorization: `Bearer ${INPOST_SHIPX_TOKEN}`,
        'Content-Type': 'application/json',
    }
}

const inpostTrackingUrl = (trackingNumber: string) =>
    `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(trackingNumber)}`

export async function handleCreateShipmentFromOrder(
    req: Request,
    body: { order_id?: string },
    corsHeaders: Record<string, string>,
): Promise<Response> {
    try {
        if (!INPOST_SHIPX_TOKEN || !INPOST_SHIPX_ORGANIZATION_ID) {
            throw new Error(
                'InPost ShipX is not configured (INPOST_SHIPX_TOKEN / INPOST_SHIPX_ORGANIZATION_ID). Automated labels are unavailable.',
            )
        }

        const authHeader = req.headers.get('Authorization') || ''
        if (!authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const orderId = String(body?.order_id || '').trim()
        if (!orderId) {
            throw new Error('order_id is required')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: authHeader } },
        })

        const { data: userData, error: userErr } = await userClient.auth.getUser()
        if (userErr || !userData?.user?.id) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const admin = createClient(supabaseUrl, supabaseService)

        const { data: order, error: orderErr } = await admin
            .from('orders')
            .select(
                'id, user_id, seller_id, status, carrier_name, tracking_number, shipping_address, shipping_method_details',
            )
            .eq('id', orderId)
            .single()

        if (orderErr || !order) {
            throw new Error('Order not found')
        }

        if (order.seller_id !== userData.user.id) {
            return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const st = String(order.status || '').toLowerCase()
        if (st !== 'paid' && st !== 'confirmed') {
            throw new Error('Order must be paid before creating a shipment')
        }

        if (order.tracking_number) {
            throw new Error('This order already has tracking')
        }

        const details = (order.shipping_method_details || {}) as Record<string, unknown>
        const carrierLabel = String(details.carrier || order.carrier_name || '').toLowerCase()
        if (!carrierLabel.includes('inpost')) {
            throw new Error('Automated InPost shipment is only available for InPost deliveries')
        }

        const shipType = String(details.type || '')
        if (shipType === 'local_pickup') {
            throw new Error('Pickup orders do not use InPost shipment creation')
        }

        const lockerId =
            details.locker && typeof details.locker === 'object' && (details.locker as { id?: string }).id
                ? String((details.locker as { id: string }).id).trim()
                : ''

        if (shipType === 'locker_pickup' && !lockerId) {
            throw new Error('Missing locker point for this order')
        }

        const tierRaw = String(details.weight_tier || 'medium').toLowerCase()
        const parcelTemplate = tierRaw === 'small' || tierRaw === 'large' ? tierRaw : 'medium'

        const service =
            shipType === 'home_delivery' ? 'inpost_courier_standard' : 'inpost_locker_standard'

        const { data: sellerProfile, error: sellerProfileErr } = await admin
            .from('profiles')
            .select('full_name, shop_shipping')
            .eq('id', order.seller_id)
            .single()

        if (sellerProfileErr || !sellerProfile) {
            throw new Error('Could not load seller profile')
        }

        const shop = (sellerProfile.shop_shipping || {}) as Record<string, unknown>
        const originStreet = String(shop.origin_street1 || '').trim()
        const originCity = String(shop.origin_city || '').trim()
        const originZip = String(shop.origin_zip || '').trim()
        const originCountry = String(shop.origin_country || 'Poland').trim()

        if (!originStreet || !originCity || !originZip) {
            throw new Error(
                'Complete your return / ship-from address in Seller shipping settings (street, city, postcode) before creating an InPost shipment.',
            )
        }

        const countryCode = originCountry.toLowerCase().includes('pol') ? 'PL' : 'PL'
        const originParts = splitStreetLine(originStreet)

        const { data: buyerAuth, error: buyerErr } = await admin.auth.admin.getUserById(order.user_id)
        if (buyerErr || !buyerAuth?.user?.email) {
            throw new Error('Could not resolve buyer email for InPost notification')
        }

        const addr = order.shipping_address as Record<string, unknown>
        const firstName = String(addr.firstName || '').trim()
        const lastName = String(addr.lastName || '').trim()
        const line1 = String(addr.line1 || '').trim()
        const city = String(addr.city || '').trim()
        const zip = normalizePostalCode(String(addr.zipCode || ''))
        const recvPhone = normalizePlPhone(addr.phone)
        if (!recvPhone || recvPhone.length < 9) {
            throw new Error('Buyer phone on the order is missing or invalid for InPost')
        }

        const recvParts = splitStreetLine(line1)

        const sellerEmail = userData.user.email || ''
        if (!sellerEmail) {
            throw new Error('Seller account email is required')
        }

        const originPhoneRaw = String((shop as Record<string, unknown>).origin_phone || '').trim()
        const senderPhone =
            normalizePlPhone(originPhoneRaw) || normalizePlPhone(INPOST_DEFAULT_SENDER_PHONE)
        if (!senderPhone || senderPhone.length < 9) {
            throw new Error(
                'Add a return contact phone in Seller shipping settings (origin phone), or set INPOST_DEFAULT_SENDER_PHONE for the platform (9-digit PL mobile).',
            )
        }

        const senderPayload = {
            company_name: String(sellerProfile.full_name || 'Seller').slice(0, 120),
            first_name: 'Sender',
            last_name: 'Culturar',
            email: sellerEmail,
            phone: senderPhone,
            address: {
                street: originParts.street,
                building_number: originParts.building_number,
                city: originCity,
                post_code: normalizePostalCode(originZip),
                country_code: countryCode,
            },
        }

        const receiverPayload = {
            first_name: firstName || 'Buyer',
            last_name: lastName || 'Culturar',
            email: buyerAuth.user.email,
            phone: recvPhone,
            address: {
                street: recvParts.street,
                building_number: recvParts.building_number,
                city,
                post_code: zip,
                country_code: 'PL',
            },
        }

        const createBody: Record<string, unknown> = {
            sender: senderPayload,
            receiver: receiverPayload,
            parcels: [{ template: parcelTemplate }],
            service,
            reference: `order-${order.id.slice(0, 8)}`,
            custom_attributes: {
                sending_method: 'dispatch_order',
                ...(lockerId ? { target_point: lockerId } : {}),
            },
        }

        const createUrl = `${INPOST_API_BASE_URL}/v1/organizations/${INPOST_SHIPX_ORGANIZATION_ID}/shipments`
        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: buildShipxHeaders(),
            body: JSON.stringify(createBody),
        })

        const createJson = await createRes.json().catch(() => ({}))
        if (!createRes.ok) {
            const msg =
                (createJson as { message?: string })?.message ||
                (createJson as { error?: string })?.error ||
                JSON.stringify(createJson)
            throw new Error(`InPost create shipment failed: ${msg}`)
        }

        const shipmentId = Number((createJson as { id?: number }).id)
        if (!Number.isFinite(shipmentId)) {
            throw new Error('InPost did not return a shipment id')
        }

        let shipment: Record<string, unknown> = createJson as Record<string, unknown>
        const maxAttempts = 45
        for (let i = 0; i < maxAttempts; i++) {
            const status = String(shipment.status || '')
            const tn = shipment.tracking_number != null ? String(shipment.tracking_number).trim() : ''
            if (tn) break

            if (status === 'error' || status === 'cancelled') {
                throw new Error(`InPost shipment entered status: ${status}`)
            }

            await new Promise((r) => setTimeout(r, 1000))
            const pollRes = await fetch(`${INPOST_API_BASE_URL}/v1/shipments/${shipmentId}`, {
                headers: buildShipxHeaders(),
            })
            shipment = (await pollRes.json().catch(() => ({}))) as Record<string, unknown>
            if (!pollRes.ok) {
                throw new Error('Failed to refresh InPost shipment status')
            }
        }

        const trackingNumber =
            shipment.tracking_number != null ? String(shipment.tracking_number).trim() : ''
        if (!trackingNumber) {
            throw new Error(
                'InPost did not return a tracking number yet. Try again in a minute, or create the shipment from the InPost panel.',
            )
        }

        const trackingUrl = inpostTrackingUrl(trackingNumber)

        const mergedDetails = {
            ...details,
            inpost_shipment_id: shipmentId,
        }

        const { error: updErr } = await admin
            .from('orders')
            .update({
                status: 'shipped',
                carrier_name: 'InPost',
                tracking_number: trackingNumber,
                tracking_url: trackingUrl,
                shipping_status: 'pre_transit',
                shipping_method_details: mergedDetails as any,
            })
            .eq('id', order.id)

        if (updErr) {
            throw new Error(`Order update failed: ${updErr.message}`)
        }

        return new Response(
            JSON.stringify({
                success: true,
                tracking_number: trackingNumber,
                tracking_url: trackingUrl,
                inpost_shipment_id: shipmentId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return new Response(JSON.stringify({ success: false, error: message }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
}
