export type ShippingRateSource = 'provider_api' | 'none';
export type PickupSearchSource = 'sendcloud' | 'inpost' | 'provider_api' | 'none';
export type ShippingProviderKey = 'inpost' | 'generic';

export interface ShippingProviderAdapter {
    providerKey: ShippingProviderKey;
    providerName: string;
    supportsLiveRates: boolean;
    supportsPickupSearch: boolean;
    rateSource: ShippingRateSource;
    pickupSearchSource: PickupSearchSource;
    serviceCode?: string;
}
