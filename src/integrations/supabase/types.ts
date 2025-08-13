export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          format: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          format?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          format?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      formats: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pillars: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_sections: {
        Row: {
          created_at: string
          id: string
          section_data: Json
          section_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          section_data?: Json
          section_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          section_data?: Json
          section_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platforms: {
        Row: {
          color: string
          created_at: string
          icon_name: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          icon_name: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_lines: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          category: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          pillar: string | null
          platform: string
          product_line: string | null
          scheduled_date: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          pillar?: string | null
          platform: string
          product_line?: string | null
          scheduled_date: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          pillar?: string | null
          platform?: string
          product_line?: string | null
          scheduled_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          id?: string
          note: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          daily_hours_goal: number | null
          google_sheet_id: string | null
          hourly_rate: number | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_hours_goal?: number | null
          google_sheet_id?: string | null
          hourly_rate?: number | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_hours_goal?: number | null
          google_sheet_id?: string | null
          hourly_rate?: number | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      woocommerce_order_items: {
        Row: {
          created_at: string
          id: number
          image_url: string | null
          name: string
          order_id: number
          price: number | null
          product_id: number | null
          quantity: number
          sku: string | null
          subtotal: number
          subtotal_tax: number | null
          tax_class: string | null
          total: number
          total_tax: number | null
          updated_at: string
          variation_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          image_url?: string | null
          name: string
          order_id: number
          price?: number | null
          product_id?: number | null
          quantity?: number
          sku?: string | null
          subtotal?: number
          subtotal_tax?: number | null
          tax_class?: string | null
          total?: number
          total_tax?: number | null
          updated_at?: string
          variation_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string | null
          name?: string
          order_id?: number
          price?: number | null
          product_id?: number | null
          quantity?: number
          sku?: string | null
          subtotal?: number
          subtotal_tax?: number | null
          tax_class?: string | null
          total?: number
          total_tax?: number | null
          updated_at?: string
          variation_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_orders: {
        Row: {
          billing_address_1: string | null
          billing_address_2: string | null
          billing_city: string | null
          billing_company: string | null
          billing_country: string | null
          billing_email: string | null
          billing_first_name: string | null
          billing_last_name: string | null
          billing_phone: string | null
          billing_postcode: string | null
          billing_state: string | null
          cart_hash: string | null
          cart_tax: number | null
          created_at: string
          created_via: string | null
          currency: string
          customer_id: number | null
          customer_ip_address: string | null
          customer_note: string | null
          customer_user_agent: string | null
          date_completed: string | null
          date_created: string
          date_modified: string | null
          date_paid: string | null
          discount_tax: number | null
          discount_total: number | null
          fulfillment_status: string
          id: number
          number: string
          order_key: string | null
          payment_method: string | null
          payment_method_title: string | null
          prices_include_tax: boolean | null
          shipping_address_1: string | null
          shipping_address_2: string | null
          shipping_city: string | null
          shipping_company: string | null
          shipping_country: string | null
          shipping_first_name: string | null
          shipping_last_name: string | null
          shipping_postcode: string | null
          shipping_state: string | null
          shipping_tax: number | null
          shipping_total: number | null
          status: string
          total: number
          total_tax: number | null
          transaction_id: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          billing_address_1?: string | null
          billing_address_2?: string | null
          billing_city?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_first_name?: string | null
          billing_last_name?: string | null
          billing_phone?: string | null
          billing_postcode?: string | null
          billing_state?: string | null
          cart_hash?: string | null
          cart_tax?: number | null
          created_at?: string
          created_via?: string | null
          currency?: string
          customer_id?: number | null
          customer_ip_address?: string | null
          customer_note?: string | null
          customer_user_agent?: string | null
          date_completed?: string | null
          date_created: string
          date_modified?: string | null
          date_paid?: string | null
          discount_tax?: number | null
          discount_total?: number | null
          fulfillment_status?: string
          id: number
          number: string
          order_key?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          prices_include_tax?: boolean | null
          shipping_address_1?: string | null
          shipping_address_2?: string | null
          shipping_city?: string | null
          shipping_company?: string | null
          shipping_country?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_postcode?: string | null
          shipping_state?: string | null
          shipping_tax?: number | null
          shipping_total?: number | null
          status?: string
          total: number
          total_tax?: number | null
          transaction_id?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          billing_address_1?: string | null
          billing_address_2?: string | null
          billing_city?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_first_name?: string | null
          billing_last_name?: string | null
          billing_phone?: string | null
          billing_postcode?: string | null
          billing_state?: string | null
          cart_hash?: string | null
          cart_tax?: number | null
          created_at?: string
          created_via?: string | null
          currency?: string
          customer_id?: number | null
          customer_ip_address?: string | null
          customer_note?: string | null
          customer_user_agent?: string | null
          date_completed?: string | null
          date_created?: string
          date_modified?: string | null
          date_paid?: string | null
          discount_tax?: number | null
          discount_total?: number | null
          fulfillment_status?: string
          id?: number
          number?: string
          order_key?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          prices_include_tax?: boolean | null
          shipping_address_1?: string | null
          shipping_address_2?: string | null
          shipping_city?: string | null
          shipping_company?: string | null
          shipping_country?: string | null
          shipping_first_name?: string | null
          shipping_last_name?: string | null
          shipping_postcode?: string | null
          shipping_state?: string | null
          shipping_tax?: number | null
          shipping_total?: number | null
          status?: string
          total?: number
          total_tax?: number | null
          transaction_id?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      work_records: {
        Row: {
          created_at: string
          date: string
          earnings: number | null
          end_time: string | null
          estimated_end_time: string | null
          id: string
          interrupts: Json | null
          is_day_off: boolean | null
          is_paused: boolean | null
          is_working: boolean | null
          paused_time: number | null
          start_time: string | null
          updated_at: string
          user_id: string
          worked_hours: number | null
        }
        Insert: {
          created_at?: string
          date: string
          earnings?: number | null
          end_time?: string | null
          estimated_end_time?: string | null
          id?: string
          interrupts?: Json | null
          is_day_off?: boolean | null
          is_paused?: boolean | null
          is_working?: boolean | null
          paused_time?: number | null
          start_time?: string | null
          updated_at?: string
          user_id: string
          worked_hours?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          earnings?: number | null
          end_time?: string | null
          estimated_end_time?: string | null
          id?: string
          interrupts?: Json | null
          is_day_off?: boolean | null
          is_paused?: boolean | null
          is_working?: boolean | null
          paused_time?: number | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
          worked_hours?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
