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
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
          saved_address: Json | null
          payment_methods: Json | null
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
          saved_address?: Json | null
          payment_methods?: Json | null
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
          saved_address?: Json | null
          payment_methods?: Json | null
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          rating: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
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
      [_ in never]: never
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