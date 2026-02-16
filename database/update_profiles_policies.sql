-- Migration to add support for shop policies and FAQs
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS shop_policies JSONB DEFAULT '{
  "accepts_returns": true,
  "accepts_exchanges": false,
  "accepts_cancellations": true,
  "return_window_days": "7",
  "return_shipping": "Buyer is responsible for return shipping costs",
  "processing_time": "1-3 business days",
  "response_time": "Within 24 hours",
  "additional_terms": "",
  "faqs": []
}'::jsonb;

-- Comment to describe the column
COMMENT ON COLUMN profiles.shop_policies IS 'Stores seller shop policies including returns, exchanges, and FAQs in JSON format';