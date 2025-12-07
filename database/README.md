# Database Schema Documentation

This folder contains SQL schema files for the Culturar marketplace app.

## Files

### 1. `products_schema.sql`
**Status:** ✅ Already exists in Supabase (created earlier)

Contains:
- `products` table - Main product catalog
- `wishlist` table - User favorites
- `recently_viewed` table - Browsing history
- Indexes, RLS policies, and triggers

**Action:** Keep for documentation. No need to run unless recreating database.

---

### 2. `cart_schema.sql`
**Status:** 🔄 Needs to be run

Contains:
- `cart` table - Shopping cart items
- `orders` table - Completed orders (one per seller)
- `order_items` table - Items in each order
- Indexes, RLS policies, and triggers

**Action:** Run this in Supabase SQL Editor to enable cart functionality.

---

## How to Run Migrations

### For New Tables (like cart_schema.sql):

1. Go to Supabase Dashboard: https://ekjwtxsjlkhntqxoxvgf.supabase.co
2. Click **SQL Editor** in sidebar
3. Click **New Query**
4. Copy and paste the SQL file content
5. Click **Run** (or Cmd+Enter)
6. Verify in **Table Editor** that tables were created

### For Existing Tables (like products_schema.sql):

**Don't run!** These tables already exist. The file is for:
- Documentation
- Version control
- Disaster recovery
- Onboarding new developers
- Recreating database in new environment

---

## Database Structure Overview

```
Culturar Database
├── Products & Discovery
│   ├── products (main catalog)
│   ├── wishlist (user favorites)
│   └── recently_viewed (browsing history)
│
├── Shopping Cart
│   ├── cart (current cart items)
│   ├── orders (completed orders)
│   └── order_items (order details)
│
└── Authentication
    └── auth.users (managed by Supabase Auth)
```

---

## Future Migrations

When adding new features, create new schema files:
- `messages_schema.sql` - For messaging system
- `reviews_schema.sql` - For product reviews
- `sellers_schema.sql` - For seller profiles
- etc.

---

## Best Practices

1. ✅ **Keep all schema files** - Don't delete after running
2. ✅ **Document changes** - Add comments in SQL
3. ✅ **Version control** - Commit schema files to git
4. ✅ **Test locally** - Use Supabase local development if possible
5. ✅ **Backup first** - Before running migrations on production

---

## Troubleshooting

### "Table already exists" error
- The table was already created
- No action needed
- Keep the schema file for documentation

### "Permission denied" error
- Check RLS policies
- Ensure you're using the correct Supabase role
- Check if user is authenticated

### "Foreign key constraint" error
- Ensure referenced tables exist first
- Run migrations in order (products → cart)

---

## Contact

For database questions, check:
- Supabase docs: https://supabase.com/docs
- Project dashboard: https://ekjwtxsjlkhntqxoxvgf.supabase.co
