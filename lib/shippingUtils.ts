// Shared shipping configuration model and helpers.
import { providerSupportsSendcloudCarrierCodes } from './sendcloudCarrierMap';

// EU Member States (for zone detection)
export const EU_COUNTRIES = [
    'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
    'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
    'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
    'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia',
    'Slovenia', 'Spain', 'Sweden',
];

export type ShippingZone = 'domestic' | 'eu' | 'international';
export type WeightTier = 'small' | 'medium' | 'large';
export type CarrierType = 'home' | 'locker' | 'pickup';
export type ShippingProviderMode = 'home_delivery' | 'locker_pickup';
export type ShippingModeKey = ShippingProviderMode | 'local_pickup';

export interface CarrierTemplate {
    name: string;
    type: Extract<CarrierType, 'home' | 'locker'>;
    mode: ShippingProviderMode;
}

export interface CarrierConfig {
    name: string;
    type: CarrierType;
    mode: ShippingProviderMode;
    enabled: boolean;
    price_small: number;
    price_medium: number;
    price_large: number;
    is_custom?: boolean;
}

export interface ShippingModeConfig {
    enabled: boolean;
    preferred_carriers: string[];
}

export interface SellerShippingConfig {
    processing_time: string;
    origin_country: string;
    origin_street1?: string;
    origin_city?: string;
    origin_state?: string;
    origin_zip?: string;
    pickup_location: string;
    shipping_zones: ('domestic' | 'eu' | 'worldwide')[];
    modes: {
        home_delivery: ShippingModeConfig & {
            use_live_rates: boolean;
            handling_fee: number;
        };
        locker_pickup: ShippingModeConfig;
        local_pickup: { enabled: boolean };
    };
    providers: CarrierConfig[];
    // Legacy aliases kept for backward compatibility with older readers.
    local_pickup: boolean;
    carriers: CarrierConfig[];
}

export const COUNTRY_PROVIDER_TEMPLATES: Record<string, CarrierTemplate[]> = {
    Poland: [
        { name: 'InPost Locker 24/7', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'DPD Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'Poczta Polska Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'InPost Home Delivery', type: 'home', mode: 'home_delivery' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    'United Kingdom': [
        { name: 'Evri ParcelShop', type: 'locker', mode: 'locker_pickup' },
        { name: 'DPD Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'Royal Mail', type: 'home', mode: 'home_delivery' },
        { name: 'Evri (Hermes)', type: 'home', mode: 'home_delivery' },
        { name: 'DPD', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Germany: [
        { name: 'DHL Packstation', type: 'locker', mode: 'locker_pickup' },
        { name: 'DPD Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'Hermes PaketShop', type: 'locker', mode: 'locker_pickup' },
        { name: 'GLS ParcelShop', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'Deutsche Post', type: 'home', mode: 'home_delivery' },
        { name: 'DPD', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Italy: [
        { name: 'Poste Italiane Punto Poste', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'GLS ParcelShop', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'Poste Italiane', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    France: [
        { name: 'Mondial Relay', type: 'locker', mode: 'locker_pickup' },
        { name: 'Chronopost Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'Colissimo Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'Colissimo', type: 'home', mode: 'home_delivery' },
        { name: 'Chronopost', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Spain: [
        { name: 'Correos Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'SEUR Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'Correos', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Netherlands: [
        { name: 'PostNL Pickup Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'DPD Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Austria: [
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'DPD Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Ireland: [
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'DPD Pickup', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
    Sweden: [
        { name: 'DHL ServicePoint / Locker', type: 'locker', mode: 'locker_pickup' },
        { name: 'PostNord Pickup Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'UPS Access Point', type: 'locker', mode: 'locker_pickup' },
        { name: 'DHL', type: 'home', mode: 'home_delivery' },
        { name: 'UPS', type: 'home', mode: 'home_delivery' },
        { name: 'FedEx', type: 'home', mode: 'home_delivery' },
    ],
};

export const FALLBACK_EU_PROVIDER_TEMPLATES: CarrierTemplate[] = [
    { name: 'DHL', type: 'home', mode: 'home_delivery' },
    { name: 'UPS', type: 'home', mode: 'home_delivery' },
    { name: 'FedEx', type: 'home', mode: 'home_delivery' },
];

export const AVAILABLE_ORIGIN_COUNTRIES = [
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'United Kingdom', flag: '🇬🇧' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'France', flag: '🇫🇷' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Hungary', flag: '🇭🇺' },
    { name: 'Greece', flag: '🇬🇷' },
].sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_CODE_TO_NAME: Record<string, string> = {
    AT: 'Austria',
    BE: 'Belgium',
    CZ: 'Czech Republic',
    DE: 'Germany',
    DK: 'Denmark',
    ES: 'Spain',
    FR: 'France',
    GB: 'United Kingdom',
    GR: 'Greece',
    HU: 'Hungary',
    IE: 'Ireland',
    IT: 'Italy',
    NL: 'Netherlands',
    PL: 'Poland',
    PT: 'Portugal',
    RO: 'Romania',
    SE: 'Sweden',
    UK: 'United Kingdom',
};

export const PROCESSING_TIMES = [
    '1 business day',
    '1-2 business days',
    '3-5 business days',
    '1-2 weeks',
    '2-4 weeks',
];

export const ZONE_OPTIONS: { key: 'domestic' | 'eu' | 'worldwide'; label: string; desc: string }[] = [
    { key: 'domestic', label: 'Domestic', desc: 'Ship within your country' },
    { key: 'eu', label: 'European Union', desc: 'Ship to EU countries (no customs)' },
    { key: 'worldwide', label: 'Worldwide', desc: 'Ship globally (customs may apply)' },
];

export const DEFAULT_SHIPPING_CONFIG: SellerShippingConfig = {
    processing_time: '3-5 business days',
    origin_country: '',
    origin_street1: '',
    origin_city: '',
    origin_state: '',
    origin_zip: '',
    pickup_location: '',
    shipping_zones: ['domestic'],
    modes: {
        home_delivery: {
            enabled: false,
            preferred_carriers: [],
            use_live_rates: false,
            handling_fee: 0,
        },
        locker_pickup: {
            enabled: false,
            preferred_carriers: [],
        },
        local_pickup: {
            enabled: false,
        },
    },
    providers: [],
    local_pickup: false,
    carriers: [],
};

const normalizeProviderMode = (carrier: Partial<CarrierConfig>): ShippingProviderMode =>
    carrier.mode || (carrier.type === 'locker' ? 'locker_pickup' : 'home_delivery');

const normalizeCarrier = (carrier: Partial<CarrierConfig>): CarrierConfig => ({
    name: carrier.name || 'Unknown Carrier',
    type: carrier.type === 'locker' ? 'locker' : carrier.type === 'pickup' ? 'pickup' : 'home',
    mode: normalizeProviderMode(carrier),
    enabled: !!carrier.enabled,
    price_small: Number(carrier.price_small) || 0,
    price_medium: Number(carrier.price_medium) || 0,
    price_large: Number(carrier.price_large) || 0,
    is_custom: !!carrier.is_custom,
});

export const normalizeCountryName = (country: string) => {
    const trimmed = country.trim();
    if (!trimmed) return '';

    const codeMatch = COUNTRY_CODE_TO_NAME[trimmed.toUpperCase()];
    if (codeMatch) return codeMatch;

    const exactMatch = AVAILABLE_ORIGIN_COUNTRIES.find(
        (item) => item.name.toLowerCase() === trimmed.toLowerCase()
    );

    return exactMatch?.name || trimmed;
};

export const getCountryFlag = (name: string) =>
    AVAILABLE_ORIGIN_COUNTRIES.find((country) => country.name === name)?.flag || '🌍';

const filterTemplatesBySupportedLockerProviders = (
    templates: CarrierTemplate[],
    supportedLockerProviders?: string[]
) => {
    if (supportedLockerProviders === undefined) {
        return templates;
    }

    if (supportedLockerProviders.length === 0) {
        return templates.filter((template) => template.mode !== 'locker_pickup');
    }

    const supportedProviderNames = new Set(supportedLockerProviders);
    return templates.filter(
        (template) =>
            template.mode !== 'locker_pickup' || supportedProviderNames.has(template.name)
    );
};

export const getSupportedLockerProviderNamesForCountry = (
    country: string,
    enabledCarrierCodes: string[] = []
) => {
    const normalizedCountry = normalizeCountryName(country);
    if (!normalizedCountry || enabledCarrierCodes.length === 0) return [];

    const baseTemplates = COUNTRY_PROVIDER_TEMPLATES[normalizedCountry] ||
        (
            AVAILABLE_ORIGIN_COUNTRIES.some((item) => item.name === normalizedCountry)
                ? FALLBACK_EU_PROVIDER_TEMPLATES
                : []
        );

    return baseTemplates
        .filter((template) => template.mode === 'locker_pickup')
        .filter((template) => providerSupportsSendcloudCarrierCodes(template.name, enabledCarrierCodes))
        .map((template) => template.name);
};

export const getProviderTemplatesForCountry = (
    country: string,
    supportedLockerProviders?: string[]
) => {
    const normalizedCountry = normalizeCountryName(country);
    if (!normalizedCountry) return [];

    if (COUNTRY_PROVIDER_TEMPLATES[normalizedCountry]) {
        return filterTemplatesBySupportedLockerProviders(
            COUNTRY_PROVIDER_TEMPLATES[normalizedCountry],
            supportedLockerProviders
        );
    }

    const isSupportedCountry = AVAILABLE_ORIGIN_COUNTRIES.some(
        (item) => item.name === normalizedCountry
    );

    return isSupportedCountry
        ? filterTemplatesBySupportedLockerProviders(FALLBACK_EU_PROVIDER_TEMPLATES, supportedLockerProviders)
        : [];
};

export const getLockedDefaultProvidersForMode = (
    country: string,
    mode: ShippingProviderMode,
    supportedLockerProviders?: string[]
) =>
    getProviderTemplatesForCountry(country, supportedLockerProviders)
        .filter((provider) => provider.mode === mode)
        .slice(0, 2)
        .map((provider) => provider.name);

export const buildProviderConfigs = (
    country: string,
    existingProviders: CarrierConfig[] = [],
    supportedLockerProviders?: string[]
) => {
    const templates = getProviderTemplatesForCountry(country, supportedLockerProviders);
    const existingByName = new Map(existingProviders.map((provider) => [provider.name, normalizeCarrier(provider)]));
    const hasExplicitSelections = existingProviders.some((provider) => normalizeCarrier(provider).enabled);
    const lockedDefaults = new Set([
        ...getLockedDefaultProvidersForMode(country, 'home_delivery', supportedLockerProviders),
        ...getLockedDefaultProvidersForMode(country, 'locker_pickup', supportedLockerProviders),
    ]);

    const suggestedProviders = templates.map((template) => {
        const existing = existingByName.get(template.name);
        if (existing) {
            return {
                ...existing,
                enabled: lockedDefaults.has(template.name) ? true : existing.enabled,
                type: template.type,
                mode: template.mode,
                is_custom: false,
            };
        }

        return {
            name: template.name,
            type: template.type,
            mode: template.mode,
            enabled: lockedDefaults.has(template.name) || !hasExplicitSelections,
            price_small: 0,
            price_medium: 0,
            price_large: 0,
            is_custom: false,
        };
    });

    return suggestedProviders;
};

const derivePreferredCarriers = (
    savedNames: string[] | undefined,
    providers: CarrierConfig[],
    mode: ShippingProviderMode
) => {
    const validNames = new Set(providers.filter((provider) => provider.mode === mode).map((provider) => provider.name));
    const preferred = Array.isArray(savedNames) ? savedNames.filter((name) => validNames.has(name)) : [];
    if (preferred.length > 0) return preferred;

    return providers
        .filter((provider) => provider.mode === mode && provider.enabled)
        .slice(0, 2)
        .map((provider) => provider.name);
};

export const hydrateShippingConfig = (
    saved?: Partial<SellerShippingConfig> | null,
    supportedLockerProviders?: string[]
): SellerShippingConfig => {
    const normalizedCountry = normalizeCountryName(saved?.origin_country || DEFAULT_SHIPPING_CONFIG.origin_country);
    const legacyProviders = Array.isArray(saved?.providers)
        ? saved.providers
        : Array.isArray(saved?.carriers)
            ? saved.carriers
            : [];
    const providers = buildProviderConfigs(
        normalizedCountry,
        legacyProviders as CarrierConfig[],
        supportedLockerProviders
    );

    const savedModes = saved?.modes;
    const hasExplicitProviderSelections = legacyProviders.some((provider) => normalizeCarrier(provider as CarrierConfig).enabled);
    const inferredHomeEnabled = providers.some((provider) => provider.mode === 'home_delivery' && provider.enabled);
    const inferredLockerEnabled = providers.some((provider) => provider.mode === 'locker_pickup' && provider.enabled);

    const homeEnabled = !hasExplicitProviderSelections && normalizedCountry
        ? inferredHomeEnabled
        : (savedModes?.home_delivery?.enabled ?? inferredHomeEnabled);
    const lockerEnabled = !hasExplicitProviderSelections && normalizedCountry
        ? inferredLockerEnabled
        : (savedModes?.locker_pickup?.enabled ?? inferredLockerEnabled);
    const localPickupEnabled = savedModes?.local_pickup?.enabled ?? saved?.local_pickup ?? false;

    const modes: SellerShippingConfig['modes'] = {
        home_delivery: {
            enabled: homeEnabled,
            preferred_carriers: derivePreferredCarriers(savedModes?.home_delivery?.preferred_carriers, providers, 'home_delivery'),
            use_live_rates: savedModes?.home_delivery?.use_live_rates ?? false,
            handling_fee: Number(savedModes?.home_delivery?.handling_fee) || 0,
        },
        locker_pickup: {
            enabled: lockerEnabled,
            preferred_carriers: derivePreferredCarriers(savedModes?.locker_pickup?.preferred_carriers, providers, 'locker_pickup'),
        },
        local_pickup: {
            enabled: localPickupEnabled,
        },
    };

    return {
        ...DEFAULT_SHIPPING_CONFIG,
        ...saved,
        origin_country: normalizedCountry,
        shipping_zones: Array.isArray(saved?.shipping_zones) && saved.shipping_zones.length > 0
            ? saved.shipping_zones
            : ['domestic'],
        pickup_location: saved?.pickup_location || '',
        modes,
        providers,
        local_pickup: modes.local_pickup.enabled,
        carriers: providers,
    };
};

export const isEU = (country: string): boolean => EU_COUNTRIES.includes(country);

export const detectShippingZone = (
    sellerCountry: string,
    buyerCountry: string
): ShippingZone => {
    if (!sellerCountry || !buyerCountry) return 'domestic';
    if (sellerCountry === buyerCountry) return 'domestic';
    if (isEU(sellerCountry) && isEU(buyerCountry)) return 'eu';
    return 'international';
};

export const WEIGHT_TIER_GRAMS: Record<WeightTier, number> = {
    small: 500,
    medium: 2000,
    large: 5000,
};

export const WEIGHT_TIER_LABELS: Record<WeightTier, string> = {
    small: 'Small (S)',
    medium: 'Medium (M)',
    large: 'Large (L)',
};

export const formatWeight = (grams: number): string => {
    if (grams >= 1000) {
        return `${(grams / 1000).toFixed(1)}kg`;
    }
    return `${grams}g`;
};

export const getTrackingUrl = (carrier: string, trackingNumber: string): string | null => {
    const c = carrier.toLowerCase();
    if (c.includes('inpost')) return `https://inpost.pl/sledzenie-przesylek?number=${trackingNumber}`;
    if (c.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
    if (c.includes('dpd')) return `https://www.dpd.com/tracking?parcelno=${trackingNumber}`;
    if (c.includes('royal mail')) return `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`;
    if (c.includes('evri') || c.includes('hermes')) return `https://www.evri.com/track/parcel/${trackingNumber}`;
    if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    if (c.includes('poczta')) return `https://śledzenie.poczta-polska.pl/?numer=${trackingNumber}`;
    if (c.includes('gls')) return `https://gls-group.com/track/${trackingNumber}`;
    if (c.includes('postnl')) return `https://postnl.nl/tracktrace/?B=${trackingNumber}`;
    if (c.includes('colissimo')) return `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}`;
    if (c.includes('correos')) return `https://www.correos.es/ss/Satellite/site/aplicacion-localizador_702-sidioma=en_GB?numero=${trackingNumber}`;
    if (c.includes('poste italiane')) return `https://www.poste.it/cerca/index.html#/risultati-di-ricerca?q=${trackingNumber}`;
    if (c.includes('brt') || c.includes('bartolini')) return `https://www.brt.it/tracking?w=auto&ids=${trackingNumber}`;
    return null;
};

export const getCarrierPrice = (
    carrier: CarrierConfig,
    weightTier: WeightTier
): number => {
    switch (weightTier) {
        case 'small': return carrier.price_small;
        case 'medium': return carrier.price_medium;
        case 'large': return carrier.price_large;
        default: return carrier.price_medium;
    }
};

export const sellerShipsToZone = (
    config: SellerShippingConfig,
    zone: ShippingZone
): boolean => {
    if (zone === 'domestic') return config.shipping_zones.includes('domestic');
    if (zone === 'eu') return config.shipping_zones.includes('eu');
    return config.shipping_zones.includes('worldwide');
};

export const isModeEnabled = (config: SellerShippingConfig, mode: ShippingModeKey) => {
    if (mode === 'local_pickup') return !!config.modes.local_pickup.enabled;
    return !!config.modes[mode].enabled;
};

export const getProvidersForMode = (
    config: SellerShippingConfig,
    mode: ShippingProviderMode
) => config.providers.filter((provider) => provider.mode === mode);

export const getEnabledCarriers = (
    config: SellerShippingConfig,
    mode?: ShippingProviderMode
): CarrierConfig[] => {
    const providers = mode ? getProvidersForMode(config, mode) : config.providers;
    return providers.filter((provider) => provider.enabled && isModeEnabled(config, provider.mode));
};

export const sortProvidersByPreference = (
    providers: CarrierConfig[],
    preferredCarriers: string[]
) => {
    const preferredSet = new Set(preferredCarriers);
    return [...providers].sort((a, b) => {
        const aPreferred = preferredSet.has(a.name);
        const bPreferred = preferredSet.has(b.name);
        if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
};

export const buildLocalPickupOption = (config: SellerShippingConfig): CarrierConfig | null => {
    if (!config.modes.local_pickup.enabled) return null;

    return {
        name: 'Local Pickup',
        type: 'pickup',
        mode: 'locker_pickup',
        enabled: true,
        price_small: 0,
        price_medium: 0,
        price_large: 0,
        is_custom: false,
    };
};
