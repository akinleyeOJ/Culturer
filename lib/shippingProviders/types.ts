export type ShippingRateSource = 'provider_api' | 'none';
export type PickupSearchSource = 'sendcloud' | 'inpost' | 'provider_api' | 'none';

export interface ShippingProviderAdapter {
    providerName: string;
    supportsLiveRates: boolean;
    supportsPickupSearch: boolean;
    rateSource: ShippingRateSource;
    pickupSearchSource: PickupSearchSource;
}
