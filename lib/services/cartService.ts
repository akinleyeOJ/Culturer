import { supabase } from "../supabase";

// Cart item interface
export interface CartItem {
    id: string;
    user_id: string;
    product_id: string;
    quantity: number;
    created_at: string;
    product: {
        id: string;
        name: string;
        price: number;
        image_url?: string;
        images?: string[];
        emoji: string;
        seller_id: string;
        seller_name: string;
        shipping: string;
        out_of_stock: boolean;
        stock_quantity: number;
    };
}

// Grouped cart by seller
export interface GroupedCart {
    [sellerId: string]: {
        sellerName: string;
        items: CartItem[];
        subtotal: number;
        shipping: number;
    };
}

// Add item to cart
export const addToCart = async (
    userId: string,
    productId: string,
    quantity: number = 1
) => {
    try {
        console.log(`Adding to cart: User ${userId}, Product ${productId}, Qty ${quantity}`);

        // Check if item already exists in cart
        const { data: existing, error: fetchError } = await supabase
            .from('cart')
            .select('*')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .maybeSingle();

        if (fetchError) {
            console.error('Error fetching existing cart item:', fetchError);
            return { success: false, error: fetchError };
        }

        if (existing) {
            // Update quantity
            const existingItem = existing as any;
            const newQuantity = (existingItem.quantity || 0) + quantity;
            console.log(`Updating existing item ${existingItem.id} to quantity ${newQuantity}`);

            const { error: updateError } = await (supabase
                .from('cart') as any)
                .update({ quantity: newQuantity })
                .eq('id', existingItem.id);

            if (updateError) {
                console.error('Error updating cart quantity:', updateError);
                return { success: false, error: updateError };
            }
            return { success: true, error: null };
        } else {
            // Insert new item
            console.log('Inserting new cart item');
            const { error: insertError } = await (supabase
                .from('cart') as any)
                .insert([{
                    user_id: userId,
                    product_id: productId,
                    quantity: quantity
                }]);

            if (insertError) {
                console.error('Error inserting cart item:', insertError);
                return { success: false, error: insertError };
            }
            return { success: true, error: null };
        }
    } catch (error) {
        console.error('Exception adding to cart:', error);
        return { success: false, error };
    }
};

// Fetch cart items
export const fetchCart = async (userId: string): Promise<CartItem[]> => {
    try {
        console.log(`Fetching cart for user ${userId}`);
        const { data, error } = await supabase
            .from('cart')
            .select(`
                *,
                product:products (
                    id,
                    name,
                    price,
                    image_url,
                    images,
                    emoji,
                    user_id,
                    shipping,
                    out_of_stock,
                    stock_quantity
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching cart:', error);
            return [];
        }

        // Filter out items where product might be null (if product was deleted)
        const validItems = (data || []).filter((item: any) => item.product != null);
        console.log(`Fetched ${validItems.length} valid cart items`);

        return validItems as CartItem[];
    } catch (error) {
        console.error('Exception fetching cart:', error);
        return [];
    }
};

// Group cart items by seller
export const groupCartBySeller = (cartItems: CartItem[]): GroupedCart => {
    const grouped: GroupedCart = {};

    cartItems.forEach(item => {
        if (!item.product) return; // Safety check

        // Use user_id as seller_id if seller_id is missing
        const product = item.product as any;
        const sellerId = product.seller_id || product.user_id || 'unknown';
        const sellerName = product.seller_name || 'Seller ' + sellerId.substr(0, 8);

        if (!grouped[sellerId]) {
            grouped[sellerId] = {
                sellerName,
                items: [],
                subtotal: 0,
                shipping: 0,
            };
        }

        grouped[sellerId].items.push(item);
        grouped[sellerId].subtotal += (item.product.price || 0) * item.quantity;

        // Parse shipping cost (e.g., "Free" or "$5.00")
        let shippingCost = 0;
        if (item.product.shipping && item.product.shipping !== 'Free') {
            shippingCost = parseFloat(item.product.shipping.replace('$', '')) || 0;
        }
        grouped[sellerId].shipping = Math.max(grouped[sellerId].shipping, shippingCost);
    });

    return grouped;
};

// Update cart item quantity
export const updateCartQuantity = async (
    cartItemId: string,
    quantity: number
) => {
    try {
        if (quantity <= 0) {
            // Remove item if quantity is 0 or negative
            return await removeFromCart(cartItemId);
        }

        const { error } = await (supabase
            .from('cart') as any)
            .update({ quantity })
            .eq('id', cartItemId);

        if (error) {
            console.error('Error updating quantity:', error);
            return { success: false, error };
        }
        return { success: true, error: null };
    } catch (error) {
        console.error('Exception updating cart quantity:', error);
        return { success: false, error };
    }
};

// Remove item from cart
export const removeFromCart = async (cartItemId: string) => {
    try {
        const { error } = await supabase
            .from('cart')
            .delete()
            .eq('id', cartItemId);

        if (error) {
            console.error('Error removing item:', error);
            return { success: false, error };
        }
        return { success: true, error: null };
    } catch (error) {
        console.error('Exception removing from cart:', error);
        return { success: false, error };
    }
};

// Clear entire cart
export const clearCart = async (userId: string) => {
    try {
        const { error } = await supabase
            .from('cart')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('Error clearing cart:', error);
            return { success: false, error };
        }
        return { success: true, error: null };
    } catch (error) {
        console.error('Exception clearing cart:', error);
        return { success: false, error };
    }
};

// Fetch cart count (total quantity of items)
export const fetchCartCount = async (userId: string): Promise<number> => {
    try {
        const { data, error } = await supabase
            .from('cart')
            .select('quantity')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching cart count:', error);
            return 0;
        }

        // Sum up the quantity of all items
        const totalCount = (data as any[])?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        return totalCount;
    } catch (error) {
        console.error('Exception fetching cart count:', error);
        return 0;
    }
};

// Calculate cart totals
export const calculateCartTotals = (groupedCart: GroupedCart) => {
    let subtotal = 0;
    let shipping = 0;
    let itemCount = 0;

    Object.values(groupedCart).forEach(seller => {
        subtotal += seller.subtotal;
        shipping += seller.shipping;
        itemCount += seller.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    const tax = subtotal * 0.1; // 10% tax (adjust as needed)
    const total = subtotal + shipping + tax;

    return {
        subtotal,
        shipping,
        tax,
        total,
        itemCount,
    };
};

// Fetch complementary products (exclude items already in cart)
export const fetchComplementaryProducts = async (excludeProductIds: string[]): Promise<any[]> => {
    try {
        let query = supabase
            .from('products')
            .select('id, name, price, image_url, images, emoji, seller_id, seller_name, user_id')
            .limit(10); // Get 10 suggestions

        if (excludeProductIds.length > 0) {
            // Supabase 'not' with 'in' expects the value to be the array usually, 
            // but strictly 'not' might expect a string representation for 'in'.
            // Simplest is to use .not('id', 'in', `(${excludeProductIds.join(',')})`) 
            // OR better: use filter.
            // Actually, Supabase JS client supports .not('id', 'in', array) usually?
            // Let's stick to the tuple string format to be safe as per my previous attempt, but cleaner.
            query = query.filter('id', 'not.in', `(${excludeProductIds.join(',')})`);
        }

        const { data, error } = await query;


        if (error) {
            console.error('Error fetching suggestions:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Exception fetching suggestions:', error);
        return [];
    }
};
