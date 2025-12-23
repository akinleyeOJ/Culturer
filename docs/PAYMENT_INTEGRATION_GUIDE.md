# Payment Integration Guide for Culturar

## 🎯 Payment Methods to Integrate

1. **Stripe** (Credit/Debit Cards)
2. **Apple Pay** (iOS devices)
3. **Google Pay** (Android devices)
4. **PayPal**
5. **Blik** (Poland only - already implemented in UI)

---

## 📦 Required Packages

```bash
# Stripe
npm install @stripe/stripe-react-native

# PayPal (React Native)
npm install react-native-paypal

# Apple Pay & Google Pay are built into Stripe
```

---

## 🏗️ Architecture Overview

### Current Setup (Demo Mode)
- ✅ UI for payment method selection
- ✅ Card input form
- ⚠️ Storing card details directly (NOT SECURE)

### Production Setup (Recommended)
```
User enters card → Stripe tokenizes → You get token → Store token → Charge later
```

**Benefits:**
- 🔒 Never touch actual card numbers
- ✅ PCI compliance handled by Stripe
- 💳 Apple Pay & Google Pay included
- 🌍 International support

---

## 🔧 Implementation Steps

### Step 1: Set Up Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Create account
3. Get API keys:
   - **Publishable Key** (for frontend)
   - **Secret Key** (for backend/Supabase Edge Functions)

### Step 2: Add Environment Variables

Add to `.env`:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Add to Supabase Edge Function secrets:
```bash
STRIPE_SECRET_KEY=sk_test_...
```

### Step 3: Install Stripe SDK

```bash
npx expo install @stripe/stripe-react-native
```

### Step 4: Update Checkout Flow

**Current Flow:**
```
1. User enters card details
2. Card details saved to database ❌ INSECURE
3. Order placed
```

**New Flow:**
```
1. User enters card details
2. Stripe creates payment method token
3. Token saved to database ✅ SECURE
4. Order placed
5. Supabase Edge Function charges the token
```

---

## 💻 Code Changes Needed

### 1. Wrap App with Stripe Provider

**File:** `app/_layout.tsx`

```tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
      {/* Your existing layout */}
    </StripeProvider>
  );
}
```

### 2. Update Payment Step

**File:** `app/checkout.tsx`

```tsx
import { CardField, useStripe } from '@stripe/stripe-react-native';

const Checkout = () => {
  const { createPaymentMethod } = useStripe();
  
  // Replace card input fields with Stripe's CardField
  const handlePayment = async () => {
    const { paymentMethod, error } = await createPaymentMethod({
      paymentMethodType: 'Card',
    });
    
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    
    // Save paymentMethod.id to database instead of card details
    await supabase.from('profiles').update({
      payment_methods: { 
        stripe_payment_method_id: paymentMethod.id,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand
      }
    }).eq('id', user.id);
  };
};
```

### 3. Create Supabase Edge Function for Charging

**File:** `supabase/functions/create-payment-intent/index.ts`

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  const { amount, paymentMethodId, orderId } = await req.json();
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'eur',
      payment_method: paymentMethodId,
      confirm: true,
      metadata: { orderId },
    });
    
    return new Response(JSON.stringify({ success: true, paymentIntent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 🍎 Apple Pay Integration

Apple Pay is built into Stripe! Just enable it:

```tsx
import { useApplePay } from '@stripe/stripe-react-native';

const { presentApplePay, confirmApplePayPayment } = useApplePay();

const handleApplePay = async () => {
  const { error } = await presentApplePay({
    cartItems: [{ label: 'Total', amount: totals.total.toString() }],
    country: 'IE',
    currency: 'EUR',
  });
  
  if (error) {
    Alert.alert('Error', error.message);
    return;
  }
  
  // Create payment intent on backend
  const { clientSecret } = await createPaymentIntent();
  
  const { error: confirmError } = await confirmApplePayPayment(clientSecret);
  
  if (!confirmError) {
    Alert.alert('Success', 'Payment completed!');
  }
};
```

---

## 🤖 Google Pay Integration

Also built into Stripe:

```tsx
import { useGooglePay } from '@stripe/stripe-react-native';

const { initGooglePay, presentGooglePay } = useGooglePay();

const handleGooglePay = async () => {
  const { error } = await initGooglePay({
    testEnv: true,
    merchantName: 'Culturar',
    countryCode: 'IE',
  });
  
  if (error) {
    Alert.alert('Error', error.message);
    return;
  }
  
  const { error: presentError } = await presentGooglePay({
    clientSecret: clientSecret, // From backend
  });
  
  if (!presentError) {
    Alert.alert('Success', 'Payment completed!');
  }
};
```

---

## 💙 PayPal Integration

For PayPal, you'll need a separate SDK:

```bash
npm install react-native-paypal
```

```tsx
import PayPal from 'react-native-paypal';

const handlePayPal = async () => {
  const result = await PayPal.paymentRequest({
    clientId: 'YOUR_PAYPAL_CLIENT_ID',
    environment: PayPal.SANDBOX, // or PayPal.PRODUCTION
    intent: PayPal.INTENT_SALE,
    price: totals.total.toString(),
    currency: 'EUR',
    description: 'Culturar Order',
  });
  
  if (result.status === 'COMPLETED') {
    // Save PayPal transaction ID
    await createOrder({ paypal_transaction_id: result.id });
  }
};
```

---

## 🗂️ Database Schema Updates

Update `payment_methods` to store tokens instead of card details:

```sql
-- Example stored data
{
  "type": "stripe",
  "payment_method_id": "pm_1234567890",
  "last4": "4242",
  "brand": "visa",
  "exp_month": 12,
  "exp_year": 2025
}

-- Or for PayPal
{
  "type": "paypal",
  "email": "user@example.com",
  "payer_id": "PAYERID123"
}
```

---

## 🚀 Migration Plan

### Phase 1: Stripe Setup (Week 1)
- [ ] Create Stripe account
- [ ] Install Stripe SDK
- [ ] Replace card inputs with Stripe CardField
- [ ] Create payment intent Edge Function
- [ ] Test card payments

### Phase 2: Apple Pay & Google Pay (Week 2)
- [ ] Enable Apple Pay in Stripe Dashboard
- [ ] Enable Google Pay in Stripe Dashboard
- [ ] Implement presentApplePay
- [ ] Implement presentGooglePay
- [ ] Test on real devices

### Phase 3: PayPal (Week 3)
- [ ] Create PayPal Business account
- [ ] Install PayPal SDK
- [ ] Implement PayPal flow
- [ ] Test PayPal payments

### Phase 4: Blik (Poland) (Week 4)
- [ ] Research Blik integration options
- [ ] Stripe supports Blik in Poland
- [ ] Implement Blik flow
- [ ] Test with Polish bank accounts

---

## 📚 Resources

- [Stripe React Native Docs](https://stripe.com/docs/payments/accept-a-payment?platform=react-native)
- [Apple Pay Setup](https://stripe.com/docs/apple-pay)
- [Google Pay Setup](https://stripe.com/docs/google-pay)
- [PayPal React Native](https://github.com/smarkets/react-native-paypal)
- [Blik via Stripe](https://stripe.com/docs/payments/blik)

---

## ⚠️ Important Security Notes

1. **Never store raw card numbers** - Always use tokens
2. **Use HTTPS** - Required for payment processing
3. **Validate on backend** - Never trust client-side validation
4. **Log everything** - For dispute resolution
5. **Test thoroughly** - Use test cards before going live

---

## 🧪 Test Cards (Stripe)

```
Visa: 4242 4242 4242 4242
Mastercard: 5555 5555 5555 4444
Amex: 3782 822463 10005
Declined: 4000 0000 0000 0002
```

Any future expiry date and any 3-digit CVC works for test cards.

---

## 💰 Pricing

**Stripe:**
- 1.4% + €0.25 per European card
- 2.9% + €0.25 per non-European card
- No monthly fees

**PayPal:**
- 2.9% + €0.35 per transaction
- No monthly fees

**Blik:**
- Included in Stripe pricing for Poland

---

## 🎯 Next Steps

1. **Remove current card storage logic** (it's insecure)
2. **Set up Stripe account**
3. **Install @stripe/stripe-react-native**
4. **Follow Phase 1 implementation**
5. **Test with Stripe test cards**

Would you like me to help you implement any specific payment method first?
