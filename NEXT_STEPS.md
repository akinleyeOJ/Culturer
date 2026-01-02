# Next Steps - Implementation Guide

## 🎯 Current Status

✅ Stripe SDK installed
✅ Stripe Provider configured  
✅ Payment methods UI updated
✅ Documentation complete
⏳ **Need to implement Stripe CardField**

---

## 📋 What to Do Next (In Order)

### **STEP 1: Get Stripe API Key** (5 min) ⭐ **DO THIS FIRST**

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (pk_test_...)
3. Open `.env` file
4. Add: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY`
5. **Restart Expo server**

### **STEP 2: Enable Przelewy24** (2 min)

1. Go to https://dashboard.stripe.com/settings/payment_methods
2. Find "Przelewy24"
3. Click "Enable"

### **STEP 3: Implement Stripe CardField** (30 min)

I'll help you replace the manual card inputs with Stripe's secure CardField.

**What needs to change:**
- Add Stripe imports
- Replace card number/expiry/CVV inputs with CardField
- Update validation logic
- Create payment method before order

### **STEP 4: Deploy Payment Function** (10 min)

Deploy the Supabase Edge Function to process payments.

### **STEP 5: Test Payments** (20 min)

Test with Stripe test cards to make sure everything works.

---

## 🔧 Detailed Implementation

### Add Stripe Imports

**At top of checkout.tsx:**
```tsx
import { CardField, useStripe } from '@stripe/stripe-react-native';
```

### Add Stripe Hooks

**After your state declarations (~line 100):**
```tsx
const { createPaymentMethod } = useStripe();
const [cardDetails, setCardDetails] = useState(null);
```

### Replace Card Inputs with CardField

**Replace lines 896-936 with:**
```tsx
<View style={{ marginBottom: 16 }}>
    <Text style={styles.formLabel}>Card Information</Text>
    <CardField
        postalCodeEnabled={false}
        placeholders={{
            number: '4242 4242 4242 4242',
        }}
        cardStyle={{
            backgroundColor: '#FFFFFF',
            textColor: Colors.text.primary,
        }}
        style={{
            width: '100%',
            height: 50,
            marginTop: 8,
        }}
        onCardChange={(details) => {
            setCardDetails(details);
        }}
    />
</View>
```

---

## 🧪 Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |

Expiry: 12/34, CVC: 123

---

## ⏱️ Time Estimate

- Setup: 10 min
- Code changes: 30-45 min
- Testing: 20 min
- **Total: ~1-1.5 hours**

---

## 🆘 Need Help?

I'm here to guide you through each step! Just let me know when you're ready to start implementing.

**First step:** Get your Stripe publishable key and add it to `.env`! 🚀
