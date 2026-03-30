import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { getSendcloudCarrierCodesForProvider } from '../sendcloudCarrierMap';

export interface SendcloudServicePoint {
    id: string;
    name: string;
    carrier: string;
    address: string;
    hint: string;
    latitude?: number;
    longitude?: number;
}

const SENDCLOUD_SERVICE_POINT_CARRIER_CODES_CACHE_KEY = 'sendcloud_service_point_carrier_codes_v1';
const SENDCLOUD_SERVICE_POINT_CARRIER_CODES_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

let inMemoryCarrierCodeCache: { carrierCodes: string[]; fetchedAt: number } | null = null;

const readCarrierCodeCache = async () => {
    if (inMemoryCarrierCodeCache) {
        return inMemoryCarrierCodeCache;
    }

    try {
        const raw = await AsyncStorage.getItem(SENDCLOUD_SERVICE_POINT_CARRIER_CODES_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as { carrierCodes?: string[]; fetchedAt?: number };
        if (!Array.isArray(parsed.carrierCodes) || typeof parsed.fetchedAt !== 'number') {
            return null;
        }

        inMemoryCarrierCodeCache = {
            carrierCodes: parsed.carrierCodes,
            fetchedAt: parsed.fetchedAt,
        };
        return inMemoryCarrierCodeCache;
    } catch {
        return null;
    }
};

const writeCarrierCodeCache = async (carrierCodes: string[]) => {
    const payload = {
        carrierCodes,
        fetchedAt: Date.now(),
    };

    inMemoryCarrierCodeCache = payload;
    try {
        await AsyncStorage.setItem(
            SENDCLOUD_SERVICE_POINT_CARRIER_CODES_CACHE_KEY,
            JSON.stringify(payload)
        );
    } catch {
        // Ignore cache write failures.
    }
};

export const fetchSendcloudServicePointCarrierCodes = async (options?: {
    forceRefresh?: boolean;
}) => {
    const cached = await readCarrierCodeCache();
    const shouldUseCache =
        !options?.forceRefresh &&
        cached &&
        Date.now() - cached.fetchedAt < SENDCLOUD_SERVICE_POINT_CARRIER_CODES_CACHE_TTL_MS;

    if (shouldUseCache) {
        return {
            success: true,
            carrierCodes: cached.carrierCodes,
            source: 'cache' as const,
        };
    }

    try {
        const { data, error } = await supabase.functions.invoke('sendcloud-handler', {
            body: {
                action: 'list-service-point-carriers',
            },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to fetch Sendcloud carrier codes');

        const carrierCodes = Array.isArray(data?.carrier_codes)
            ? (data.carrier_codes as string[]).filter(Boolean)
            : [];

        await writeCarrierCodeCache(carrierCodes);
        return {
            success: true,
            carrierCodes,
            source: 'live' as const,
        };
    } catch (err: any) {
        if (cached?.carrierCodes?.length) {
            return {
                success: true,
                carrierCodes: cached.carrierCodes,
                source: 'stale-cache' as const,
            };
        }

        if (__DEV__) {
            console.warn('Sendcloud carrier-capability lookup unavailable.', err?.message || err);
        }

        return {
            success: false,
            carrierCodes: [] as string[],
            error: err?.message || 'Sendcloud carrier-capability lookup unavailable',
            source: 'unavailable' as const,
        };
    }
};

export const fetchSendcloudServicePoints = async (params: {
    carrierName: string;
    country: string;
    address: string;
    radius?: number;
    carrierCodes?: string[];
}) => {
    try {
        const carrierCodes = params.carrierCodes?.length
            ? params.carrierCodes
            : getSendcloudCarrierCodesForProvider(params.carrierName);

        const { data, error } = await supabase.functions.invoke('sendcloud-handler', {
            body: {
                action: 'list-service-points',
                carrier_name: params.carrierName,
                carrier_codes: carrierCodes,
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
