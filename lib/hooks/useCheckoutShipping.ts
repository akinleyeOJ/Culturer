import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../supabase';
import { type CartItem } from '../services/cartService';
import { type PickupPointResult, type PickupPointSearchContext } from '../services/pickupPointService';
import { fetchSendcloudServicePointCarrierCodes } from '../services/sendcloudService';
import { fetchShippingRates, type ShippoParcel, type ShippoRate } from '../services/shippingService';
import { getShippingProviderAdapter, providerSupportsLiveRates } from '../shippingProviders/registry';
import {
    buildLocalPickupOption,
    detectShippingZone,
    getEnabledCarriers,
    getSupportedLockerProviderNamesForCountry,
    hydrateShippingConfig,
    sortProvidersByPreference,
    WEIGHT_TIER_GRAMS,
    type CarrierConfig,
    type SellerShippingConfig,
    type ShippingZone,
    type WeightTier,
} from '../shippingUtils';
import {
    clearPickupPointSelectionState,
    getPickupPointSelectionState,
} from '../pickupPointSelectionStore';

const buildShippoRequestSignature = (params: {
    sellerId: string;
    buyerCountry: string;
    buyerCity: string;
    buyerZip: string;
    buyerAddress1: string;
    totalWeightGrams: number;
}) =>
    [
        params.sellerId,
        params.buyerCountry.trim().toLowerCase(),
        params.buyerCity.trim().toLowerCase(),
        params.buyerZip.trim().toLowerCase(),
        params.buyerAddress1.trim().toLowerCase(),
        params.totalWeightGrams,
    ].join('|');

const normalizeProviderName = (value: string) =>
    value
        .toLowerCase()
        .replace(/[()/]/g, ' ')
        .replace(/\b(locker|pickup|pick up|servicepoint|service point|access point|parcelshop|packstation|home delivery|delivery)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const shippoRateMatchesProvider = (rate: ShippoRate, providerName: string) => {
    const normalizedRateProvider = normalizeProviderName(rate.provider);
    const normalizedProvider = normalizeProviderName(providerName);

    return (
        normalizedRateProvider.includes(normalizedProvider) ||
        normalizedProvider.includes(normalizedRateProvider)
    );
};

const getIsoCode = (name: string) => {
    const map: Record<string, string> = {
        Poland: 'PL', Germany: 'DE', France: 'FR', 'United Kingdom': 'GB',
        Italy: 'IT', Spain: 'ES', Netherlands: 'NL', Belgium: 'BE',
        Portugal: 'PT', Austria: 'AT', Sweden: 'SE', Denmark: 'DK',
        Ireland: 'IE', Bulgaria: 'BG', Croatia: 'HR', Cyprus: 'CY',
        'Czech Republic': 'CZ', Estonia: 'EE', Finland: 'FI', Greece: 'GR',
        Hungary: 'HU', Latvia: 'LV', Lithuania: 'LT', Luxembourg: 'LU',
        Malta: 'MT', Romania: 'RO', Slovakia: 'SK', Slovenia: 'SI',
    };
    return map[name] || name;
};

interface UseCheckoutShippingParams {
    cartItems: CartItem[];
    country: string;
    city: string;
    zipCode: string;
    address1: string;
    address2: string;
    firstName: string;
    lastName: string;
    phone: string;
    step: 1 | 2 | 3;
    liveShippingApisEnabled: boolean;
}

export const useCheckoutShipping = ({
    cartItems,
    country,
    city,
    zipCode,
    address1,
    address2,
    firstName,
    lastName,
    phone,
    step,
    liveShippingApisEnabled,
}: UseCheckoutShippingParams) => {
    const [sellerShipping, setSellerShipping] = useState<SellerShippingConfig | null>(null);
    const [shippingZone, setShippingZone] = useState<ShippingZone>('domestic');
    const [selectedCarrier, setSelectedCarrier] = useState<CarrierConfig | null>(null);
    const [totalWeightGrams, setTotalWeightGrams] = useState(0);
    const [cartWeightTier, setCartWeightTier] = useState<WeightTier>('medium');
    const [selectedLocker, setSelectedLocker] = useState<PickupPointResult | null>(null);
    const [lockerSearch, setLockerSearch] = useState('');
    const [lockerSearchContext, setLockerSearchContext] = useState<PickupPointSearchContext | null>(null);
    const [shippoRates, setShippoRates] = useState<ShippoRate[]>([]);
    const [loadingRates, setLoadingRates] = useState(false);
    const [selectedShippoRate, setSelectedShippoRate] = useState<ShippoRate | null>(null);
    const [shippoShipmentId, setShippoShipmentId] = useState<string | null>(null);
    const shippoRequestSignatureRef = useRef<string | null>(null);
    const shippoRateCacheRef = useRef<Map<string, { rates: ShippoRate[]; shipmentId: string | null }>>(new Map());

    const enabledHomeProviders = useMemo(
        () =>
            sellerShipping
                ? getEnabledCarriers(sellerShipping, 'home_delivery').filter((provider) =>
                    providerSupportsLiveRates(provider.name)
                )
                : [],
        [sellerShipping]
    );

    const enabledLockerProviders = useMemo(
        () => (sellerShipping ? getEnabledCarriers(sellerShipping, 'locker_pickup') : []),
        [sellerShipping]
    );

    const localPickupOption = useMemo(
        () => (sellerShipping ? buildLocalPickupOption(sellerShipping) : null),
        [sellerShipping]
    );

    const filteredShippoRates = useMemo(() => {
        if (shippoRates.length === 0 || enabledHomeProviders.length === 0) return [];
        return shippoRates.filter((rate) =>
            enabledHomeProviders.some((provider) => shippoRateMatchesProvider(rate, provider.name))
        );
    }, [shippoRates, enabledHomeProviders]);

    const integratedCarrierOptions = useMemo(() => {
        if (!sellerShipping) return [];

        const liveRateNonShippoProviders = sortProvidersByPreference(
            [...enabledHomeProviders, ...enabledLockerProviders].filter((provider) => {
                const adapter = getShippingProviderAdapter(provider.name);
                return !!adapter?.supportsLiveRates && adapter.rateSource !== 'shippo';
            }),
            [
                ...sellerShipping.modes.home_delivery.preferred_carriers,
                ...sellerShipping.modes.locker_pickup.preferred_carriers,
            ]
        );

        return [
            ...liveRateNonShippoProviders,
            ...(localPickupOption ? [localPickupOption] : []),
        ];
    }, [sellerShipping, enabledHomeProviders, enabledLockerProviders, localPickupOption]);

    useEffect(() => {
        const fetchSellerShipping = async () => {
            if (cartItems.length === 0) return;

            const sellerId = cartItems[0]?.product?.seller_id;
            if (!sellerId || sellerId === 'system') return;

            try {
                const [{ data: profile, error }, carrierCapabilityResult] = await Promise.all([
                    supabase
                        .from('profiles' as any)
                        .select('shop_shipping')
                        .eq('id', sellerId)
                        .single(),
                    fetchSendcloudServicePointCarrierCodes(),
                ]);

                if (!error && (profile as any)?.shop_shipping) {
                    const rawShipping = (profile as any).shop_shipping as SellerShippingConfig;
                    const liveSupportedLockerProviders = getSupportedLockerProviderNamesForCountry(
                        rawShipping?.origin_country || '',
                        carrierCapabilityResult.success ? carrierCapabilityResult.carrierCodes : []
                    );
                    const config = hydrateShippingConfig(rawShipping, liveSupportedLockerProviders);
                    setSellerShipping(config);
                }
            } catch (err) {
                console.error('Error fetching seller shipping config:', err);
            }
        };

        fetchSellerShipping();
    }, [cartItems]);

    useEffect(() => {
        if (!country || !sellerShipping) return;
        const zone = detectShippingZone(sellerShipping.origin_country, country);
        setShippingZone(zone);
    }, [country, sellerShipping]);

    useEffect(() => {
        if (selectedCarrier && !integratedCarrierOptions.some((carrier) => carrier.name === selectedCarrier.name)) {
            setSelectedCarrier(null);
            setSelectedLocker(null);
            setLockerSearch('');
            setLockerSearchContext(null);
            clearPickupPointSelectionState();
        }
    }, [integratedCarrierOptions, selectedCarrier]);

    useEffect(() => {
        if (selectedShippoRate && !filteredShippoRates.some((rate) => rate.object_id === selectedShippoRate.object_id)) {
            setSelectedShippoRate(null);
        }
    }, [filteredShippoRates, selectedShippoRate]);

    useEffect(() => {
        if (filteredShippoRates.length > 0 && selectedCarrier?.type === 'home') {
            setSelectedCarrier(null);
        }
    }, [filteredShippoRates, selectedCarrier]);

    useEffect(() => {
        if (cartItems.length === 0) return;

        const fetchWeights = async () => {
            const productIds = cartItems.map((item) => item.product_id);
            const { data: products } = await supabase
                .from('products')
                .select('id, weight_tier')
                .in('id', productIds);

            let totalGrams = 0;
            let maxTier: WeightTier = 'small';
            const tierOrder: WeightTier[] = ['small', 'medium', 'large'];

            cartItems.forEach((item) => {
                const product = products?.find((p: any) => p.id === item.product_id);
                const tier = (product?.weight_tier as WeightTier) || 'medium';
                totalGrams += WEIGHT_TIER_GRAMS[tier] * item.quantity;

                if (tierOrder.indexOf(tier) > tierOrder.indexOf(maxTier)) {
                    maxTier = tier;
                }
            });

            setTotalWeightGrams(totalGrams);
            setCartWeightTier(maxTier);
        };

        fetchWeights();
    }, [cartItems]);

    const refreshShippoRates = useCallback(async () => {
        if (
            !liveShippingApisEnabled ||
            !zipCode.trim() ||
            !country.trim() ||
            !city.trim() ||
            address1.trim().length < 5 ||
            cartItems.length === 0
        ) {
            setShippoRates([]);
            return;
        }

        try {
            const sellerId = cartItems[0]?.product?.seller_id;
            if (!sellerId || sellerId === 'system') {
                return;
            }

            const { data: profile } = await supabase
                .from('profiles' as any)
                .select('shop_shipping')
                .eq('id', sellerId)
                .single();

            const shopShipping = (profile as any)?.shop_shipping;
            const normalizedShipping = hydrateShippingConfig(shopShipping as SellerShippingConfig | null);

            const originAddress = {
                street: normalizedShipping.origin_street1 || '',
                city: normalizedShipping.origin_city || '',
                state: normalizedShipping.origin_state || '',
                zip: normalizedShipping.origin_zip || '',
                country: normalizedShipping.origin_country || '',
            };

            if (
                !normalizedShipping.modes.home_delivery.enabled ||
                !originAddress.street ||
                !originAddress.city ||
                !originAddress.zip ||
                !originAddress.country
            ) {
                setShippoRates([]);
                return;
            }

            const requestSignature = buildShippoRequestSignature({
                sellerId,
                buyerCountry: country,
                buyerCity: city,
                buyerZip: zipCode,
                buyerAddress1: address1,
                totalWeightGrams: totalWeightGrams || 500,
            });

            if (shippoRequestSignatureRef.current === requestSignature) {
                return;
            }

            const cached = shippoRateCacheRef.current.get(requestSignature);
            if (cached) {
                shippoRequestSignatureRef.current = requestSignature;
                setShippoRates(cached.rates);
                setShippoShipmentId(cached.shipmentId);
                return;
            }

            const addressTo = {
                name: `${firstName} ${lastName}`.trim() || 'Buyer',
                street1: address1,
                street2: address2,
                city,
                state: '',
                zip: zipCode,
                country: getIsoCode(country),
                phone,
            };

            const addressFrom = {
                name: cartItems[0]?.product?.seller_name || 'Seller',
                street1: originAddress.street,
                city: originAddress.city,
                state: originAddress.state,
                zip: originAddress.zip,
                country: getIsoCode(originAddress.country),
            };

            const parcels: ShippoParcel[] = [{
                length: 10,
                width: 10,
                height: 10,
                distance_unit: 'cm',
                weight: totalWeightGrams || 500,
                mass_unit: 'g',
            }];

            setLoadingRates(true);
            const result = await fetchShippingRates(addressTo as any, addressFrom as any, parcels);
            if (result.success && result.rates) {
                shippoRequestSignatureRef.current = requestSignature;
                shippoRateCacheRef.current.set(requestSignature, {
                    rates: result.rates,
                    shipmentId: result.shipmentId || null,
                });
                setShippoRates(result.rates);
                setShippoShipmentId(result.shipmentId || null);
            } else {
                shippoRequestSignatureRef.current = requestSignature;
                setShippoRates([]);
                console.error('Failed to fetch Shippo rates:', result.error);
            }
        } catch (err) {
            console.error('Error in refreshShippoRates:', err);
            setShippoRates([]);
        } finally {
            setLoadingRates(false);
        }
    }, [
        liveShippingApisEnabled,
        zipCode,
        country,
        city,
        address1,
        cartItems,
        totalWeightGrams,
        firstName,
        lastName,
        address2,
        phone,
    ]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (
                step === 1 &&
                liveShippingApisEnabled &&
                zipCode.trim().length >= 3 &&
                city.trim().length >= 2 &&
                address1.trim().length >= 5 &&
                country.trim().length >= 2 &&
                cartItems.length > 0
            ) {
                refreshShippoRates();
            }
        }, 1800);

        return () => clearTimeout(timer);
    }, [zipCode, country, city, address1, cartItems, step, totalWeightGrams, liveShippingApisEnabled, refreshShippoRates]);

    useFocusEffect(
        useCallback(() => {
            const pickupState = getPickupPointSelectionState();
            if (
                pickupState.carrierName &&
                selectedCarrier?.type === 'locker' &&
                pickupState.carrierName === selectedCarrier.name
            ) {
                setSelectedLocker(pickupState.selection);
                setLockerSearch(pickupState.search);
                setLockerSearchContext(pickupState.context);
            }
        }, [selectedCarrier])
    );

    const shippingCost = useMemo(() => {
        if (selectedShippoRate) {
            return Number(selectedShippoRate.amount);
        }

        if (selectedCarrier) {
            return selectedCarrier.type === 'pickup' ? 0 : 0;
        }

        return 0;
    }, [selectedShippoRate, selectedCarrier]);

    return {
        sellerShipping,
        shippingZone,
        selectedCarrier,
        setSelectedCarrier,
        totalWeightGrams,
        cartWeightTier,
        selectedLocker,
        setSelectedLocker,
        lockerSearch,
        setLockerSearch,
        lockerSearchContext,
        setLockerSearchContext,
        loadingRates,
        filteredShippoRates,
        selectedShippoRate,
        setSelectedShippoRate,
        shippoShipmentId,
        integratedCarrierOptions,
        shippingCost,
    };
};
