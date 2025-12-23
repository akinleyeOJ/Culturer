# Saved Addresses Troubleshooting Guide

## Problem
Saved addresses disappear when you leave checkout page or refresh the app.

## Root Causes & Solutions

### 1. Missing Database Column ❌
**Check:** Does the `saved_address` column exist in your `profiles` table?

**Fix:** Run this SQL in Supabase SQL Editor:
```sql
-- See: database/fix_saved_address.sql
```

### 2. Missing RLS Policies ❌ (MOST COMMON ISSUE)
**Check:** Do you have UPDATE policy on profiles table?

**Fix:** Run this SQL in Supabase SQL Editor:
```sql
-- See: database/profiles_rls_policies.sql
```

### 3. Wrong Data Type ❌
**Check:** Is `saved_address` column type `JSONB`?

**Fix:** It should be `JSONB NOT NULL DEFAULT '[]'::jsonb`

## Step-by-Step Fix

### Step 1: Run Both SQL Files
1. Go to Supabase Dashboard → SQL Editor
2. Run `database/fix_saved_address.sql`
3. Run `database/profiles_rls_policies.sql`

### Step 2: Verify in Supabase
1. Go to Table Editor → profiles
2. Check the `saved_address` column exists
3. Go to Authentication → Policies → profiles
4. Verify you see these policies:
   - ✅ "Users can view own profile" (SELECT)
   - ✅ "Users can update own profile" (UPDATE)
   - ✅ "Users can insert own profile" (INSERT)

### Step 3: Test in App
1. Open checkout page
2. Fill in address details
3. Click "Save Address"
4. Check Expo console for logs:
   ```
   Saving addresses: [...]
   Address saved successfully: [...]
   ```
5. Leave checkout and come back
6. Check console for:
   ```
   Raw saved_address from DB: [...]
   Parsed addresses: [...]
   ```

### Step 4: If Still Not Working
Check Expo console for errors:
- If you see "Error saving address" → RLS policy issue
- If you see "Column not found" → Run fix_saved_address.sql
- If no error but still not saving → Check Supabase logs

## Quick Test
Run this in Supabase SQL Editor to test manually:
```sql
-- Replace 'YOUR_USER_ID' with your actual user ID
UPDATE profiles 
SET saved_address = '[{"firstName":"Test","lastName":"User","line1":"123 Test St","city":"Test City","zipCode":"12345","country":"Ireland","phone":"1234567890"}]'::jsonb
WHERE id = 'YOUR_USER_ID';

-- Then check if it saved
SELECT saved_address FROM profiles WHERE id = 'YOUR_USER_ID';
```

## Expected Console Output (When Working)
```
Saving addresses: [{firstName: "John", lastName: "Doe", ...}]
Address saved successfully: [{...}]
--- After refresh ---
Raw saved_address from DB: [{firstName: "John", lastName: "Doe", ...}]
Parsed addresses: [{firstName: "John", lastName: "Doe", ...}]
```
