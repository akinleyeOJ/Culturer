import { supabase } from '../supabase';

export interface SendcloudServicePoint {
    id: string;
    name: string;
    carrier: string;
    address: string;
    hint: string;
    latitude?: number;
    longitude?: number;
}

export const fetchSendcloudServicePoints = async (params: {
    carrierName: string;
    country: string;
    address: string;
    radius?: number;
}) => {
    try {
        const { data, error } = await supabase.functions.invoke('sendcloud-handler', {
            body: {
                action: 'list-service-points',
                carrier_name: params.carrierName,
                country: params.country,
                address: params.address,
                radius: params.radius || 15000,
            },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to fetch service points');

        return {
            success: true,
            servicePoints: (data.service_points || []) as SendcloudServicePoint[],
        };
    } catch (err: any) {
        if (__DEV__) {
            console.warn('Sendcloud service-point lookup unavailable, falling back.', err?.message || err);
        }
        return { success: false, error: err?.message || 'Service point lookup unavailable' };
    }
};
