export type CheckoutStep = 1 | 2 | 3;
export type CheckoutShippingMethod = 'standard' | 'express' | 'carrier';

export interface CheckoutAddress {
    line1: string;
    line2: string;
    city: string;
    zipCode: string;
    country: string;
    phone: string;
    firstName: string;
    lastName: string;
    label?: string;
}
