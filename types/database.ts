export interface Database {
    public: {
      Tables: {
        profiles: {
          Row: {
            id: string;
            full_name: string | null;
            avatar_url: string | null;
            bio: string | null;
            created_at: string;
            updated_at: string;
          };
        };
        products: {
          Row: {
            id: string;
            user_id: string;
            name: string;
            description: string | null;
            price: number;
            category: string | null;
            subcategory: string | null;
            image_url: string | null;
            images: string[];
            emoji: string | null;
            rating: number;
            reviews_count: number;
            shipping: string;
            in_stock: boolean;
            out_of_stock: boolean;
            is_featured: boolean;
            total_views: number;
            total_favorites: number;
            cultural_origin: string | null;
            condition: 'new' | 'like_new' | 'good' | 'fair';
            stock_quantity: number;
            created_at: string;
            updated_at: string;
          };
        };
        wishlist: {
          Row: {
            id: string;
            user_id: string;
            product_id: string;
            created_at: string;
          };
        };
        recently_viewed: {
          Row: {
            id: string;
            user_id: string;
            product_id: string;
            viewed_at: string;
          };
        };
        reviews: {
          Row: {
            id: string;
            product_id: string;
            user_id: string;
            rating: number;
            comment: string | null;
            created_at: string;
            updated_at: string;
          };
        };
      };
    };
  }
  
  // UI-friendly product type
  export interface UIProduct {
    id: string;
    name: string;
    price: string;              // Formatted: "$20.00"
    emoji: string;
    image?: string;
    images?: string[];
    rating: number;
    reviews: number;            // maps to reviews_count
    shipping: string;
    outOfStock: boolean;        // maps to out_of_stock or !in_stock
    isFavorited?: boolean;      // true if in wishlist
    badge?: "NEW" | "HOT" | null;
  }
  
  // Recently viewed product type
  export interface UIRecentlyViewedProduct {
    id: string;
    name: string;
    price: string;
    emoji: string;
    image?: string;
  }