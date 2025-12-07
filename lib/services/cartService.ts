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
        // Check if item already exists in cart
        const { data: existing } = await supabase
            .from('cart')
            .select('*')
            .eq('user_id', userId)
            .eq('product_id', productId)
            .maybeSingle();

        if (existing) {
            // Update quantity
            // @ts-ignore - Supabase type inference issue
            const { error } = await supabase
                .from('cart')
                .update({ quantity: (existing as any).quantity + quantity } as any)
                .eq('id', (existing as any).id);

            return { success: !error, error };
        } else {
            // Insert new item
            // @ts-ignore - Supabase type inference issue
            const { error } = await supabase
                .from('cart')
                .insert([{ user_id: userId, product_id: productId, quantity }] as any);

            return { success: !error, error };
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        return { success: false, error };
    }
};

// Fetch cart items
export const fetchCart = async (userId: string): Promise<CartItem[]> => {
    try {
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
          seller_id,
          seller_name,
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

        return (data || []) as any;
    } catch (error) {
        console.error('Error fetching cart:', error);
        return [];
    }
};

// Group cart items by seller
export const groupCartBySeller = (cartItems: CartItem[]): GroupedCart => {
    const grouped: GroupedCart = {};

    cartItems.forEach(item => {
        const sellerId = item.product.seller_id;
        const sellerName = item.product.seller_name;

        if (!grouped[sellerId]) {
            grouped[sellerId] = {
                sellerName,
                items: [],
                subtotal: 0,
                shipping: 0,
            };
        }

        grouped[sellerId].items.push(item);
        grouped[sellerId].subtotal += item.product.price * item.quantity;

        // Parse shipping cost (e.g., "Free" or "$5.00")
        const shippingCost = item.product.shipping === 'Free'
            ? 0
            : parseFloat(item.product.shipping.replace('$', '')) || 0;
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


        // @ts-ignore - Supabase type inference issue
        const { error } = await supabase
            .from('cart')
            .update({ quantity } as any)
            .eq('id', cartItemId);

        return { success: !error, error };
    } catch (error) {
        console.error('Error updating cart quantity:', error);
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

        return { success: !error, error };
    } catch (error) {
        console.error('Error removing from cart:', error);
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

        return { success: !error, error };
    } catch (error) {
        console.error('Error clearing cart:', error);
        return { success: false, error };
    }
};

// Get cart count
export const fetchCartCount = async (userId: string): Promise<number> => {
    try {
        const { count, error } = await supabase
            .from('cart')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) return 0;
        return count || 0;
    } catch (error) {
        console.error('Error fetching cart count:', error);
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
