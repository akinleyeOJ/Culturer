-- Check which products are owned by which users
SELECT 
  p.id as product_id, 
  p.name as product_name, 
  p.user_id as owner_id, 
  prof.full_name as owner_name, 
  prof.id as profile_id
FROM products p
LEFT JOIN profiles prof ON p.user_id = prof.id;
