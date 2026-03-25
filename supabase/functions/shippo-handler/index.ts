// Supabase Edge Function: shippo-handler
// Handles Shipping Rate calculation and Label Purchasing using Shippo API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Shippo Handler function started')

const SHIPPO_API_KEY = Deno.env.get('SHIPPO_API_KEY') || ''
const SHIPPO_API_URL = 'https://api.goshippo.com'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { action, ...data } = await req.json()

        if (!SHIPPO_API_KEY) {
            throw new Error('SHIPPO_API_KEY is not configured')
        }

        if (action === 'create-rates') {
            return await handleCreateRates(data)
        } else if (action === 'purchase-label') {
            return await handlePurchaseLabel(data)
        } else if (action === 'register-tracking') {
            return await handleRegisterTracking(data)
        } else {
            throw new Error(`Invalid action: ${action}`)
        }

    } catch (error: any) {
        console.error('Shippo error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

async function handleCreateRates(data: any) {
    const { address_to, address_from, parcels } = data

    const response = await fetch(`${SHIPPO_API_URL}/shipments/`, {
        method: 'POST',
        headers: {
            'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            address_from,
            address_to,
            parcels,
            async: false,
        }),
    })

    const shipment = await response.json()

    if (!response.ok) {
        throw new Error(shipment.message || shipment.detail || 'Failed to fetch rates')
    }

    // Return the rates list
    return new Response(
        JSON.stringify({ 
            success: true, 
            shipment_id: shipment.object_id,
            rates: shipment.rates 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
}

async function handlePurchaseLabel(data: any) {
    const { rate_id, order_id, metadata } = data

    const response = await fetch(`${SHIPPO_API_URL}/transactions/`, {
        method: 'POST',
        headers: {
            'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            rate: rate_id,
            label_file_type: 'PDF',
            async: false,
            metadata: JSON.stringify({ order_id, ...metadata }),
        }),
    })

    const transaction = await response.json()

    if (!response.ok) {
        throw new Error(transaction.message || transaction.detail || 'Failed to purchase label')
    }

    // Update the order in Supabase using service role
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (order_id && transaction.object_status === 'SUCCESS') {
        const { error } = await supabaseAdmin
            .from('orders')
            .update({
                tracking_number: transaction.tracking_number,
                courier_name: transaction.provider,
                tracking_url: transaction.tracking_url_provider,
                label_url: transaction.label_url,
                shippo_transaction_id: transaction.object_id,
                shipping_status: 'pre_transit'
            })
            .eq('id', order_id)

        if (error) console.error('Error updating order with tracking:', error)
    }

    return new Response(
        JSON.stringify({ success: true, transaction }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
}

async function handleRegisterTracking(data: any) {
    const { carrier, tracking_number, order_id } = data

    const response = await fetch(`${SHIPPO_API_URL}/tracks/`, {
        method: 'POST',
        headers: {
            'Authorization': `ShippoToken ${SHIPPO_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            carrier,
            tracking_number,
            metadata: order_id ? JSON.stringify({ order_id }) : undefined
        }),
    })

    const track = await response.json()

    if (!response.ok) {
        throw new Error(track.message || track.detail || 'Failed to register tracking')
    }

    return new Response(
        JSON.stringify({ success: true, track }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
}
