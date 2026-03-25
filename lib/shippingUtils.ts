// ─── Shipping Utilities ──────────────────────────────
// Shared logic for zone detection, weight tiers, and carrier tracking

// EU Member States (for zone detection)
export const EU_COUNTRIES = [
    'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
    'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
    'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
    'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia',
    'Slovenia', 'Spain', 'Sweden',
];

// Note: UK is NOT in the EU
export const isEU = (country: string): boolean =>
    EU_COUNTRIES.includes(country);

// ─── Zone Detection ──────────────────────────────
export type ShippingZone = 'domestic' | 'eu' | 'international';

export const detectShippingZone = (
    sellerCountry: string,
    buyerCountry: string
): ShippingZone => {
    if (!sellerCountry || !buyerCountry) return 'domestic';

    // Same country = Domestic
    if (sellerCountry === buyerCountry) return 'domestic';

    // Both in EU = EU cross-border (no customs)
    if (isEU(sellerCountry) && isEU(buyerCountry)) return 'eu';

    // Everything else = International (customs may apply)
    return 'international';
};

// ─── Weight Tiers ──────────────────────────────
export type WeightTier = 'small' | 'medium' | 'large';

export const WEIGHT_TIER_GRAMS: Record<WeightTier, number> = {
    small: 500,    // 500g
    medium: 2000,  // 2kg
    large: 5000,   // 5kg
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

// ─── Carrier Tracking URLs ──────────────────────────────
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

// ─── Seller Carrier Config Types ──────────────────────────────
export interface CarrierConfig {
    name: string;
    type: 'home' | 'locker' | 'pickup';
    enabled: boolean;
    price_small: number;
    price_medium: number;
    price_large: number;
}

export interface SellerShippingConfig {
    processing_time: string;
    origin_country: string;
    origin_street1?: string;
    origin_city?: string;
    origin_state?: string;
    origin_zip?: string;
    local_pickup: boolean;
    pickup_location: string;
    carriers: CarrierConfig[];
    shipping_zones: ('domestic' | 'eu' | 'worldwide')[];
}

// Get the price for a specific carrier and weight tier
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

// Check if seller ships to the detected zone
export const sellerShipsToZone = (
    config: SellerShippingConfig,
    zone: ShippingZone
): boolean => {
    if (zone === 'domestic') return config.shipping_zones.includes('domestic');
    if (zone === 'eu') return config.shipping_zones.includes('eu');
    return config.shipping_zones.includes('worldwide');
};

// Get enabled carriers from seller config
export const getEnabledCarriers = (config: SellerShippingConfig): CarrierConfig[] => {
    return config.carriers.filter(c => c.enabled);
};
