export type CheckoutStep = 1 | 2 | 3;

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
