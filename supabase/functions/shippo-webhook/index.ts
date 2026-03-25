// Supabase Edge Function: shippo-webhook
// Handles asynchronous tracking updates from Shippo (track_updated)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Shippo Webhook function up and running!')

serve(async (req) => {
    try {
        const body = await req.json()
        const { event, data } = body

        if (event !== 'track_updated') {
            console.log(`Ignoring event type: ${event}`)
            return new Response(JSON.stringify({ received: true }), { status: 200 })
        }

        console.log(`Processing tracking update for: ${data.tracking_number} (${data.status})`)

        // 1. Initialize Supabase Admin
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Find the order associated with this tracking number
        // First try via metadata (if it was a Shippo label)
        let orderId = null
        if (data.metadata) {
            try {
                const meta = JSON.parse(data.metadata)
                orderId = meta.order_id
            } catch (e) {
                // Not JSON, or no order_id
            }
        }

        // If no metadata, look up by tracking number in DB
        if (!orderId) {
            const { data: order, error } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('tracking_number', data.tracking_number)
                .single()

            if (order) orderId = order.id
        }

        if (!orderId) {
            console.warn(`Could not find order for tracking number: ${data.tracking_number}`)
            return new Response(JSON.stringify({ received: true, warning: 'Order not found' }), { status: 200 })
        }

        // 3. Map Shippo status to our shipping_status
        // Statuses: UNKNOWN, PRE_TRANSIT, IN_TRANSIT, DELIVERED, RETURNED, FAILURE
        const shippingStatus = data.status.toLowerCase()
        
        // 4. Update the Order
        const updateData: any = {
            shipping_status: shippingStatus,
            updated_at: new Date().toISOString()
        }

        // If DELIVERED, update the main order status too
        if (shippingStatus === 'delivered') {
            updateData.status = 'delivered'
        }

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', orderId)

        if (updateError) throw updateError

        console.log(`Order ${orderId} updated to shipping_status: ${shippingStatus}`)

        // 5. Trigger Notifications (Optional: integrated logic here or via DB Trigger)
        // For now, we've synced the DB which is the source of truth.

        return new Response(JSON.stringify({ received: true, orderId }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (err: any) {
        console.error('Error processing Shippo webhook:', err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
