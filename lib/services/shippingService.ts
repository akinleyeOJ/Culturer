import { supabase } from "../supabase";

export interface ShippoAddress {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
}

export interface ShippoParcel {
    length: number;
    width: number;
    height: number;
    distance_unit: 'cm' | 'in';
    weight: number;
    mass_unit: 'g' | 'lb' | 'oz' | 'kg';
}

export interface ShippoRate {
    object_id: string;
    provider: string;
    servicelevel: {
        name: string;
        token: string;
        terms: string;
    };
    amount: string;
    currency: string;
    estimated_days: number;
    duration_terms: string;
}

/**
 * Fetches real-time shipping rates from Shippo via Edge Function
 */
export const fetchShippingRates = async (
    addressTo: ShippoAddress,
    addressFrom: ShippoAddress,
    parcels: ShippoParcel[]
) => {
    try {
        const { data, error } = await supabase.functions.invoke('shippo-handler', {
            body: {
                action: 'create-rates',
                address_to: addressTo,
                address_from: addressFrom,
                parcels,
            }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to fetch rates');

        return {
            success: true,
            shipmentId: data.shipment_id,
            rates: data.rates as ShippoRate[]
        };
    } catch (err: any) {
        console.error('Error in fetchShippingRates:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Purchases a shipping label for an order
 */
export const purchaseShippingLabel = async (
    rateId: string,
    orderId: string,
    metadata: any = {}
) => {
    try {
        const { data, error } = await supabase.functions.invoke('shippo-handler', {
            body: {
                action: 'purchase-label',
                rate_id: rateId,
                order_id: orderId,
                metadata,
            }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to purchase label');

        return {
            success: true,
            transaction: data.transaction
        };
    } catch (err: any) {
        console.error('Error in purchaseShippingLabel:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Registers an existing tracking number for monitoring
 */
export const registerTracking = async (
    carrier: string,
    trackingNumber: string,
    orderId?: string
) => {
    try {
        const { data, error } = await supabase.functions.invoke('shippo-handler', {
            body: {
                action: 'register-tracking',
                carrier,
                tracking_number: trackingNumber,
                order_id: orderId,
            }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to register tracking');

        return {
            success: true,
            track: data.track
        };
    } catch (err: any) {
        console.error('Error in registerTracking:', err);
        return { success: false, error: err.message };
    }
};
