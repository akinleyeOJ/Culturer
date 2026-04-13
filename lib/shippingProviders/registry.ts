import { normalizeCarrierLookupValue } from '../sendcloudCarrierMap';
import { type ShippingProviderAdapter } from './types';

const createDirectHomeAdapter = (providerName: string): ShippingProviderAdapter => ({
    providerName,
    supportsLiveRates: false,
    supportsPickupSearch: false,
    rateSource: 'provider_api',
    pickupSearchSource: 'none',
});

const createSendcloudPickupAdapter = (providerName: string): ShippingProviderAdapter => ({
    providerName,
    supportsLiveRates: false,
    supportsPickupSearch: true,
    rateSource: 'none',
    pickupSearchSource: 'sendcloud',
});

const createInPostLockerAdapter = (providerName: string): ShippingProviderAdapter => ({
    providerName,
    supportsLiveRates: false,
    supportsPickupSearch: true,
    rateSource: 'none',
    pickupSearchSource: 'inpost',
});

const createLocalPickupAdapter = (): ShippingProviderAdapter => ({
    providerName: 'Local Pickup',
    supportsLiveRates: false,
    supportsPickupSearch: false,
    rateSource: 'none',
    pickupSearchSource: 'none',
});

const SHIPPING_PROVIDER_ADAPTERS: Record<string, ShippingProviderAdapter> = {
    'inpost home delivery': createDirectHomeAdapter('InPost Home Delivery'),
    dhl: createDirectHomeAdapter('DHL'),
    dpd: createDirectHomeAdapter('DPD'),
    ups: createDirectHomeAdapter('UPS'),
    fedex: createDirectHomeAdapter('FedEx'),
    'royal mail': createDirectHomeAdapter('Royal Mail'),
    'evri (hermes)': createDirectHomeAdapter('Evri (Hermes)'),
    colissimo: createDirectHomeAdapter('Colissimo'),
    chronopost: createDirectHomeAdapter('Chronopost'),
    correos: createDirectHomeAdapter('Correos'),
    'deutsche post': createDirectHomeAdapter('Deutsche Post'),
    'poste italiane': createDirectHomeAdapter('Poste Italiane'),
    'evri parcelshop': createSendcloudPickupAdapter('Evri ParcelShop'),
    'dpd pickup': createSendcloudPickupAdapter('DPD Pickup'),
    'dhl servicepoint / locker': createSendcloudPickupAdapter('DHL ServicePoint / Locker'),
    'ups access point': createSendcloudPickupAdapter('UPS Access Point'),
    'poczta polska pickup': createSendcloudPickupAdapter('Poczta Polska Pickup'),
    'dhl packstation': createSendcloudPickupAdapter('DHL Packstation'),
    'hermes paketshop': createSendcloudPickupAdapter('Hermes PaketShop'),
    'gls parcelshop': createSendcloudPickupAdapter('GLS ParcelShop'),
    'poste italiane punto poste': createSendcloudPickupAdapter('Poste Italiane Punto Poste'),
    'mondial relay': createSendcloudPickupAdapter('Mondial Relay'),
    'chronopost pickup': createSendcloudPickupAdapter('Chronopost Pickup'),
    'colissimo pickup': createSendcloudPickupAdapter('Colissimo Pickup'),
    'correos pickup': createSendcloudPickupAdapter('Correos Pickup'),
    'seur pickup': createSendcloudPickupAdapter('SEUR Pickup'),
    'postnl pickup point': createSendcloudPickupAdapter('PostNL Pickup Point'),
    'postnord pickup point': createSendcloudPickupAdapter('PostNord Pickup Point'),
    'inpost locker 24/7': createInPostLockerAdapter('InPost Locker 24/7'),
    'local pickup': createLocalPickupAdapter(),
};

export const getShippingProviderAdapter = (providerName: string): ShippingProviderAdapter | null =>
    SHIPPING_PROVIDER_ADAPTERS[normalizeCarrierLookupValue(providerName)] || null;

export const providerSupportsLiveRates = (providerName: string) =>
    !!getShippingProviderAdapter(providerName)?.supportsLiveRates;

export const providerSupportsPickupSearch = (providerName: string) =>
    !!getShippingProviderAdapter(providerName)?.supportsPickupSearch;
