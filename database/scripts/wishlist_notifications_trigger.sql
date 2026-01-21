-- Add dynamic wishlist notifications for price and stock changes

CREATE OR REPLACE FUNCTION handle_product_changes()
RETURNS TRIGGER AS $$
DECLARE
    wishlist_user RECORD;
    notif_title TEXT;
    notif_body TEXT;
    notif_type TEXT := 'activity';
BEGIN
    -- Check for Price Change (usually users care more about price drops)
    IF OLD.price > NEW.price THEN
        notif_title := 'Price Drop! 💸';
        notif_body := 'The price for "' || NEW.name || '" just dropped from $' || OLD.price || ' to $' || NEW.price || '!';
    ELSIF OLD.price < NEW.price THEN
        -- Optional: notify on price increase? Usually not, but the user asked for "Price change"
        notif_title := 'Price Updated';
        notif_body := 'The price for "' || NEW.name || '" has been updated to $' || NEW.price || '.';
    END IF;

    -- Check for Stock Changes
    -- Back in Stock
    IF (OLD.in_stock = false AND NEW.in_stock = true) OR (OLD.stock_quantity = 0 AND NEW.stock_quantity > 0) THEN
        notif_title := 'Back in Stock! ✨';
        notif_body := 'Great news! "' || NEW.name || '" is back in stock and available for purchase.';
    -- Out of Stock
    ELSIF (OLD.in_stock = true AND NEW.in_stock = false) OR (OLD.stock_quantity > 0 AND NEW.stock_quantity = 0) THEN
        notif_title := 'Out of Stock 🛑';
        notif_body := 'The item "' || NEW.name || '" in your wishlist is currently out of stock.';
    END IF;

    -- If we have a notification to send
    IF notif_title IS NOT NULL THEN
        -- Find all users who have this product in their wishlist
        FOR wishlist_user IN 
            SELECT user_id FROM wishlist WHERE product_id = NEW.id
        LOOP
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
                wishlist_user.user_id,
                notif_type,
                notif_title,
                notif_body,
                jsonb_build_object(
                    'product_id', NEW.id,
                    'old_price', OLD.price,
                    'new_price', NEW.price,
                    'old_stock', OLD.stock_quantity,
                    'new_stock', NEW.stock_quantity
                )
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_product_notifications ON products;
CREATE TRIGGER trigger_product_notifications
    AFTER UPDATE ON products
    FOR EACH ROW
    WHEN (OLD.price IS DISTINCT FROM NEW.price OR 
          OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity OR 
          OLD.in_stock IS DISTINCT FROM NEW.in_stock)
    EXECUTE FUNCTION handle_product_changes();
