import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../supabase';
import { type CartItem } from '../services/cartService';
import { fetchInPostCalculatedRates } from '../services/inpostService';
import { type PickupPointResult, type PickupPointSearchContext } from '../services/pickupPointService';
import { fetchSendcloudServicePointCarrierCodes } from '../services/sendcloudService';
import { getShippingProviderAdapter, providerSupportsLiveRates } from '../shippingProviders/registry';
import {
    buildLocalPickupOption,
    detectShippingZone,
    getEnabledCarriers,
    SHIPPING_LAUNCH_COUNTRY,
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

interface UseCheckoutShippingParams {
    cartItems: CartItem[];
    email: string;
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
    email,
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
    const [quoteMap, setQuoteMap] = useState<Record<string, {
        amount: number | null;
        currency: string | null;
        quoteId: string | null;
        status: 'ready' | 'loading' | 'requires_pickup_point' | 'missing_address' | 'unavailable';
    }>>({});
    const [sellerShipping, setSellerShipping] = useState<SellerShippingConfig | null>(null);
    const [shippingZone, setShippingZone] = useState<ShippingZone>('domestic');
    const [selectedCarrier, setSelectedCarrier] = useState<CarrierConfig | null>(null);
    const [totalWeightGrams, setTotalWeightGrams] = useState(0);
    const [cartWeightTier, setCartWeightTier] = useState<WeightTier>('medium');
    const [selectedLocker, setSelectedLocker] = useState<PickupPointResult | null>(null);
    const [lockerSearch, setLockerSearch] = useState('');
    const [lockerSearchContext, setLockerSearchContext] = useState<PickupPointSearchContext | null>(null);
    const [loadingRates, setLoadingRates] = useState(false);
    const isPolandDomesticRoute = sellerShipping?.origin_country === SHIPPING_LAUNCH_COUNTRY && country === SHIPPING_LAUNCH_COUNTRY;

    const enabledHomeProviders = useMemo(
        () =>
            sellerShipping && isPolandDomesticRoute
                ? getEnabledCarriers(sellerShipping, 'home_delivery').filter((provider) =>
                    providerSupportsLiveRates(provider.name)
                )
                : [],
        [isPolandDomesticRoute, sellerShipping]
    );

    const enabledLockerProviders = useMemo(
        () => (sellerShipping && isPolandDomesticRoute ? getEnabledCarriers(sellerShipping, 'locker_pickup') : []),
        [isPolandDomesticRoute, sellerShipping]
    );

    const localPickupOption = useMemo(
        () => (sellerShipping && isPolandDomesticRoute ? buildLocalPickupOption(sellerShipping) : null),
        [isPolandDomesticRoute, sellerShipping]
    );

    const integratedCarrierOptions = useMemo(() => {
        if (!sellerShipping) return [];

        const liveRateProviders = sortProvidersByPreference(
            [...enabledHomeProviders, ...enabledLockerProviders].filter((provider) => {
                const adapter = getShippingProviderAdapter(provider.name);
                return !!adapter?.supportsLiveRates;
            }),
            [
                ...sellerShipping.modes.home_delivery.preferred_carriers,
                ...sellerShipping.modes.locker_pickup.preferred_carriers,
            ]
        );

        return [
            ...liveRateProviders.map((provider) => {
                const quote = quoteMap[provider.name];
                return {
                    ...provider,
                    quote_amount: quote?.amount ?? null,
                    quote_currency: quote?.currency ?? null,
                    quote_id: quote?.quoteId ?? null,
                    quote_status: quote?.status,
                };
            }),
            ...(localPickupOption ? [localPickupOption] : []),
        ];
    }, [sellerShipping, enabledHomeProviders, enabledLockerProviders, localPickupOption, quoteMap]);

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

    useEffect(() => {
        if (!liveShippingApisEnabled || !sellerShipping || !isPolandDomesticRoute) {
            setQuoteMap({});
            setLoadingRates(false);
            return;
        }

        const directProviders = [...enabledHomeProviders, ...enabledLockerProviders].filter((provider) => {
            const adapter = getShippingProviderAdapter(provider.name);
            return adapter?.providerKey === 'inpost' && adapter.supportsLiveRates;
        });

        if (directProviders.length === 0) {
            setQuoteMap({});
            setLoadingRates(false);
            return;
        }

        const hasReceiverAddress =
            !!email.trim() &&
            !!firstName.trim() &&
            !!lastName.trim() &&
            !!phone.trim() &&
            !!address1.trim() &&
            !!city.trim() &&
            !!zipCode.trim() &&
            country === SHIPPING_LAUNCH_COUNTRY;

        if (!hasReceiverAddress) {
            setQuoteMap(
                Object.fromEntries(
                    directProviders.map((provider) => [
                        provider.name,
                        {
                            amount: null,
                            currency: null,
                            quoteId: null,
                            status: provider.type === 'locker' ? 'requires_pickup_point' : 'missing_address',
                        },
                    ])
                )
            );
            setLoadingRates(false);
            return;
        }

        const requestShipments = directProviders.flatMap((provider) => {
            const adapter = getShippingProviderAdapter(provider.name);
            if (!adapter?.serviceCode) return [];

            if (provider.type === 'locker' && !selectedLocker?.id) {
                return [];
            }

            return [{
                id: `${provider.name}-${provider.type}`,
                service: adapter.serviceCode,
                parcelTemplate: cartWeightTier,
                receiver: {
                    email: email.trim(),
                    phone: phone.trim(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    address1: address1.trim(),
                    address2: address2.trim(),
                    city: city.trim(),
                    postalCode: zipCode.trim(),
                    countryCode: 'PL' as const,
                },
                ...(provider.type === 'locker' && selectedLocker?.id ? { targetPoint: selectedLocker.id } : {}),
            }];
        });

        setQuoteMap(
            Object.fromEntries(
                directProviders.map((provider) => [
                    provider.name,
                    {
                        amount: null,
                        currency: null,
                        quoteId: null,
                        status: provider.type === 'locker' && !selectedLocker?.id ? 'requires_pickup_point' : 'loading',
                    },
                ])
            )
        );

        if (requestShipments.length === 0) {
            setLoadingRates(false);
            return;
        }

        let isCancelled = false;
        setLoadingRates(true);

        const run = async () => {
            const result = await fetchInPostCalculatedRates(requestShipments);
            if (isCancelled) return;

            const ratesById = new Map(result.rates.map((rate) => [rate.id, rate]));

            setQuoteMap(
                Object.fromEntries(
                    directProviders.map((provider) => {
                        const quoteId = `${provider.name}-${provider.type}`;
                        const rate = ratesById.get(quoteId);

                        if (provider.type === 'locker' && !selectedLocker?.id) {
                            return [provider.name, {
                                amount: null,
                                currency: null,
                                quoteId: null,
                                status: 'requires_pickup_point' as const,
                            }];
                        }

                        if (rate?.amount != null) {
                            return [provider.name, {
                                amount: rate.amount,
                                currency: rate.currency || 'PLN',
                                quoteId,
                                status: 'ready' as const,
                            }];
                        }

                        return [provider.name, {
                            amount: null,
                            currency: rate?.currency || 'PLN',
                            quoteId,
                            status: 'unavailable' as const,
                        }];
                    })
                )
            );

            setLoadingRates(false);
        };

        run().catch((error) => {
            console.error('Error fetching direct provider quotes:', error);
            if (!isCancelled) {
                setQuoteMap(
                    Object.fromEntries(
                        directProviders.map((provider) => [
                            provider.name,
                            {
                                amount: null,
                                currency: 'PLN',
                                quoteId: `${provider.name}-${provider.type}`,
                                status: provider.type === 'locker' && !selectedLocker?.id ? 'requires_pickup_point' : 'unavailable',
                            },
                        ])
                    )
                );
                setLoadingRates(false);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [
        address1,
        address2,
        cartItems.length,
        cartWeightTier,
        city,
        country,
        email,
        enabledHomeProviders,
        enabledLockerProviders,
        firstName,
        isPolandDomesticRoute,
        lastName,
        liveShippingApisEnabled,
        phone,
        selectedLocker?.id,
        sellerShipping,
        step,
        zipCode,
    ]);

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
        if (selectedCarrier) {
            if (selectedCarrier.type === 'pickup') {
                return 0;
            }

            return Number(selectedCarrier.quote_amount) || 0;
        }

        return 0;
    }, [selectedCarrier]);

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
        integratedCarrierOptions,
        shippingCost,
    };
};
