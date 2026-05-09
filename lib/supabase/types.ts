export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type StudioRole = "owner" | "senior_designer" | "designer" | "intern"
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived"
export type ProjectType = "residential" | "commercial" | "hospitality" | "retail" | "other"
export type PlanTier = "starter" | "pro" | "scale"

export interface Database {
  public: {
    Tables: {
      invitations: {
        Row: {
          id: string
          studio_id: string
          email: string
          role: StudioRole
          token: string
          invited_by_id: string | null
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          email: string
          role?: StudioRole
          token?: string
          invited_by_id?: string | null
          accepted_at?: string | null
          expires_at?: string
        }
        Update: {
          email?: string
          role?: StudioRole
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      studios: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          gstin: string | null
          address_line1: string | null
          address_line2: string | null
          address_line3: string | null
          postcode: string | null
          state_code: string | null
          contact_phone: string | null
          contact_email: string | null
          bank_details: Json | null
          currency: string
          gst_brackets: Json | null
          plan_tier: PlanTier
          whatsapp_number: string | null
          invoice_prefix: string
          onboarding_complete: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          gstin?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          postcode?: string | null
          state_code?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          bank_details?: Json | null
          currency?: string
          gst_brackets?: Json | null
          plan_tier?: PlanTier
          whatsapp_number?: string | null
          invoice_prefix?: string
          onboarding_complete?: boolean
        }
        Update: {
          name?: string
          logo_url?: string | null
          gstin?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          postcode?: string | null
          state_code?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          bank_details?: Json | null
          currency?: string
          gst_brackets?: Json | null
          plan_tier?: PlanTier
          whatsapp_number?: string | null
          invoice_prefix?: string
          onboarding_complete?: boolean
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          studio_id: string | null
          name: string
          email: string
          phone: string | null
          whatsapp_number: string | null
          dob: string | null
          address: string | null
          emergency_contact: Json | null
          role: StudioRole
          permissions: Json | null
          hourly_rate: number | null
          employment_type: string | null
          employment_start_date: string | null
          bank_details: Json | null
          profile_photo_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          studio_id?: string | null
          name: string
          email: string
          phone?: string | null
          whatsapp_number?: string | null
          dob?: string | null
          address?: string | null
          emergency_contact?: Json | null
          role?: StudioRole
          permissions?: Json | null
          hourly_rate?: number | null
          employment_type?: string | null
          employment_start_date?: string | null
          bank_details?: Json | null
          profile_photo_url?: string | null
          is_active?: boolean
        }
        Update: {
          studio_id?: string | null
          name?: string
          email?: string
          phone?: string | null
          whatsapp_number?: string | null
          dob?: string | null
          address?: string | null
          emergency_contact?: Json | null
          role?: StudioRole
          permissions?: Json | null
          hourly_rate?: number | null
          employment_type?: string | null
          employment_start_date?: string | null
          bank_details?: Json | null
          profile_photo_url?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_studio_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: StudioRole
      }
      next_invoice_number: {
        Args: { p_studio_id: string }
        Returns: string
      }
      handle_new_user_signup: {
        Args: {
          p_user_id: string
          p_user_name: string
          p_user_email: string
          p_studio_name: string
        }
        Returns: void
      }
    }
    Enums: {
      studio_role: StudioRole
      project_status: ProjectStatus
      project_type: ProjectType
      plan_tier: PlanTier
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience aliases
export type Studio = Database["public"]["Tables"]["studios"]["Row"]
export type User = Database["public"]["Tables"]["users"]["Row"]
