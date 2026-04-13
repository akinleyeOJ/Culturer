import { normalizeCarrierLookupValue } from '../sendcloudCarrierMap';
import { type ShippingProviderAdapter } from './types';

const createShippoHomeAdapter = (providerName: string): ShippingProviderAdapter => ({
    providerName,
    supportsLiveRates: true,
    supportsPickupSearch: false,
    rateSource: 'shippo',
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
    dhl: createShippoHomeAdapter('DHL'),
    dpd: createShippoHomeAdapter('DPD'),
    ups: createShippoHomeAdapter('UPS'),
    fedex: createShippoHomeAdapter('FedEx'),
    'royal mail': createShippoHomeAdapter('Royal Mail'),
    'evri (hermes)': createShippoHomeAdapter('Evri (Hermes)'),
    colissimo: createShippoHomeAdapter('Colissimo'),
    chronopost: createShippoHomeAdapter('Chronopost'),
    correos: createShippoHomeAdapter('Correos'),
    'deutsche post': createShippoHomeAdapter('Deutsche Post'),
    'poste italiane': createShippoHomeAdapter('Poste Italiane'),
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
