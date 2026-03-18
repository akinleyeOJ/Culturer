export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          username: string | null
          avatar_url: string | null
          cover_url: string | null
          bio: string | null
          location: string | null
          cultures: Json | null
          instagram_handle: string | null
          facebook_handle: string | null
          website_url: string | null
          created_at: string
          updated_at: string
          saved_address: Json | null
          payment_methods: Json | null
          shop_policies: Json | null
          shipping_preferences: Json | null
          shop_shipping: Json | null
          spoken_languages: string[] | null
          shipping_regions: string[] | null
          is_verified: boolean
          verification_status: 'none' | 'pending' | 'verified' | 'rejected'
          verification_document_url: string | null
          role: 'user' | 'admin'
          verification_rejection_reason: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          bio?: string | null
          location?: string | null
          cultures?: Json | null
          instagram_handle?: string | null
          facebook_handle?: string | null
          website_url?: string | null
          created_at?: string
          updated_at?: string
          saved_address?: Json | null
          payment_methods?: Json | null
          shop_policies?: Json | null
          shipping_preferences?: Json | null
          shop_shipping?: Json | null
          spoken_languages?: string[] | null
          shipping_regions?: string[] | null
          is_verified?: boolean
          verification_status?: 'none' | 'pending' | 'verified' | 'rejected'
          verification_document_url?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          bio?: string | null
          location?: string | null
          cultures?: Json | null
          instagram_handle?: string | null
          facebook_handle?: string | null
          website_url?: string | null
          created_at?: string
          updated_at?: string
          saved_address?: Json | null
          payment_methods?: Json | null
          shop_policies?: Json | null
          shipping_preferences?: Json | null
          shop_shipping?: Json | null
          spoken_languages?: string[] | null
          shipping_regions?: string[] | null
          is_verified?: boolean
          verification_status?: 'none' | 'pending' | 'verified' | 'rejected'
          verification_document_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          price: number
          category: string | null
          subcategory: string | null
          image_url: string | null
          images: string[]
          emoji: string | null
          rating: number
          reviews_count: number
          shipping: string
          in_stock: boolean
          out_of_stock: boolean
          is_featured: boolean
          total_views: number
          total_favorites: number
          cultural_origin: string | null
          condition: 'new' | 'like_new' | 'good' | 'fair'
          stock_quantity: number
          seller_id: string
          pickup_available: boolean
          free_shipping: boolean
          express_shipping: boolean
          shipping_days_min: number | null
          shipping_days_max: number | null
          discount_percentage: number
          promotion_ends_at: string | null
          weight_tier: 'small' | 'medium' | 'large'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          price: number
          category?: string | null
          subcategory?: string | null
          image_url?: string | null
          images: string[]
          emoji?: string | null
          rating?: number
          reviews_count?: number
          shipping: string
          in_stock?: boolean
          out_of_stock?: boolean
          is_featured?: boolean
          total_views?: number
          total_favorites?: number
          cultural_origin?: string | null
          condition: 'new' | 'like_new' | 'good' | 'fair'
          stock_quantity: number
          seller_id: string
          pickup_available?: boolean
          free_shipping?: boolean
          express_shipping?: boolean
          shipping_days_min?: number | null
          shipping_days_max?: number | null
          discount_percentage?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string | null
          subcategory?: string | null
          image_url?: string | null
          images?: string[]
          emoji?: string | null
          rating?: number
          reviews_count?: number
          shipping?: string
          in_stock?: boolean
          out_of_stock?: boolean
          is_featured?: boolean
          total_views?: number
          total_favorites?: number
          cultural_origin?: string | null
          condition?: 'new' | 'like_new' | 'good' | 'fair'
          stock_quantity?: number
          seller_id?: string
          pickup_available?: boolean
          free_shipping?: boolean
          express_shipping?: boolean
          shipping_days_min?: number | null
          shipping_days_max?: number | null
          discount_percentage?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      listing_analytics: {
        Row: {
          id: string
          product_id: string
          seller_id: string
          event_type: 'view' | 'save' | 'sale'
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          seller_id: string
          event_type: 'view' | 'save' | 'sale'
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          seller_id?: string
          event_type?: 'view' | 'save' | 'sale'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_analytics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_analytics_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      cart: {
        Row: {
          id: string
          user_id: string
          product_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      wishlist: {
        Row: {
          id: string
          user_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      recently_viewed: {
        Row: {
          id: string
          user_id: string
          product_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_viewed_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          product_id: string
          user_id: string
          rating: number
          comment: string | null
          seller_reply: string | null
          seller_replied_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          rating: number
          comment?: string | null
          seller_reply?: string | null
          seller_replied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
          seller_reply?: string | null
          seller_replied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          id: string
          user_id: string
          seller_id: string
          subtotal: number
          shipping_cost: number
          tax: number
          total_amount: number
          status: string
          shipping_address: Json
          payment_method: string
          notes: string | null
          carrier_name: string | null
          tracking_number: string | null
          shipping_method_details: Json | null
          shipping_zone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          seller_id: string
          subtotal: number
          shipping_cost: number
          tax: number
          total_amount: number
          status: string
          shipping_address: Json
          payment_method: string
          notes?: string | null
          carrier_name?: string | null
          tracking_number?: string | null
          shipping_method_details?: Json | null
          shipping_zone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          seller_id?: string
          subtotal?: number
          shipping_cost?: number;
          tax?: number;
          total_amount?: number;
          status?: string;
          shipping_address?: Json;
          payment_method?: string
          notes?: string | null
          carrier_name?: string | null
          tracking_number?: string | null
          shipping_method_details?: Json | null
          shipping_zone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          price: number
          product_name: string
          product_image: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          price: number
          product_name: string
          product_image?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          price?: number
          product_name?: string
          product_image?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_total_views: {
        Args: {
          product_id: string
        }
        Returns: undefined
      }
      increment_total_favorites: {
        Args: {
          product_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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