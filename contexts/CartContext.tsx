import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchCartCount } from '../lib/services/cartService';

type CartContextType = {
    cartCount: number;
    refreshCartCount: () => Promise<void>;
};

const CartContext = createContext<CartContextType>({
    cartCount: 0,
    refreshCartCount: async () => { },
});

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [cartCount, setCartCount] = useState(0);

    const refreshCartCount = useCallback(async () => {
        if (user) {
            const count = await fetchCartCount(user.id);
            setCartCount(count);
        } else {
            setCartCount(0);
        }
    }, [user]);

    // Initial fetch when user changes
    useEffect(() => {
        refreshCartCount();
    }, [refreshCartCount]);

    return (
        <CartContext.Provider value={{ cartCount, refreshCartCount }}>
            {children}
        </CartContext.Provider>
    );
};
