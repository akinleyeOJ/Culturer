export const SENDCLOUD_PROVIDER_CARRIER_CODES: Record<string, string[]> = {
    'colissimo pickup': ['colissimo', 'la_poste'],
    'correos pickup': ['correos'],
    'dhl packstation': ['dhl'],
    'dhl servicepoint / locker': ['dhl'],
    'dpd pickup': ['dpd'],
    'evri parcelshop': ['evri', 'hermes'],
    'gls parcelshop': ['gls'],
    'hermes paketshop': ['hermes'],
    'inpost locker 24/7': ['inpost'],
    'mondial relay': ['mondial_relay', 'mondialrelay'],
    'poczta polska pickup': ['poczta_polska', 'pocztex'],
    'postnl pickup point': ['postnl'],
    'poste italiane punto poste': ['poste_italiane', 'posteitaliane'],
    'postnord pickup point': ['postnord'],
    'seur pickup': ['seur'],
    'ups access point': ['ups'],
};

export const normalizeCarrierLookupValue = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

export const getSendcloudCarrierCodesForProvider = (providerName: string) =>
    SENDCLOUD_PROVIDER_CARRIER_CODES[normalizeCarrierLookupValue(providerName)] || [];

export const providerSupportsSendcloudCarrierCodes = (
    providerName: string,
    enabledCarrierCodes: string[] = []
) => {
    const expectedCodes = getSendcloudCarrierCodesForProvider(providerName);
    if (expectedCodes.length === 0) return false;

    const enabledCodes = new Set(enabledCarrierCodes.map((code) => normalizeCarrierLookupValue(code)));
    return expectedCodes.some((code) => enabledCodes.has(normalizeCarrierLookupValue(code)));
};
