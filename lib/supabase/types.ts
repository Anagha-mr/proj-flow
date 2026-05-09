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
export type TaskStatus = "todo" | "in_progress" | "review" | "done"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type ProjectRole = "project_lead" | "senior_designer" | "designer" | "intern" | "site_coordinator"

export interface PhaseItem {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  color: string
}

export interface ScopeItem {
  id: string
  text: string
  linked_task_id?: string | null
}

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
      clients: {
        Row: {
          id: string
          studio_id: string
          name: string
          company: string | null
          email: string | null
          phone_primary: string | null
          phone_secondary: string | null
          address_line1: string | null
          address_line2: string | null
          address_line3: string | null
          postcode: string | null
          state_code: string | null
          whatsapp_number: string | null
          preferred_comms: string
          available_hours: string | null
          social_media: Json
          portal_token: string
          portal_token_expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          name: string
          company?: string | null
          email?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          postcode?: string | null
          state_code?: string | null
          whatsapp_number?: string | null
          preferred_comms?: string
          available_hours?: string | null
          social_media?: Json
        }
        Update: {
          name?: string
          company?: string | null
          email?: string | null
          phone_primary?: string | null
          whatsapp_number?: string | null
          preferred_comms?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      process_templates: {
        Row: {
          id: string
          studio_id: string
          name: string
          project_type: string
          phases: Json
          tasks: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          name: string
          project_type: string
          phases?: Json
          tasks?: Json
          is_default?: boolean
        }
        Update: {
          name?: string
          project_type?: string
          phases?: Json
          tasks?: Json
          is_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          studio_id: string
          client_id: string | null
          name: string
          type: string
          type_custom: string | null
          status: string
          status_custom: string | null
          address_line1: string | null
          address_line2: string | null
          address_line3: string | null
          postcode: string | null
          cover_image_url: string | null
          currency: string
          gst_bracket: string | null
          measurement_unit: string
          scope_description: string | null
          scope_items: Json
          phases: Json
          template_id: string | null
          pinterest_url: string | null
          is_pinned: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          client_id?: string | null
          name: string
          type?: string
          type_custom?: string | null
          status?: string
          status_custom?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          postcode?: string | null
          cover_image_url?: string | null
          currency?: string
          gst_bracket?: string | null
          measurement_unit?: string
          scope_description?: string | null
          scope_items?: Json
          phases?: Json
          template_id?: string | null
          pinterest_url?: string | null
          is_pinned?: boolean
          created_by?: string | null
        }
        Update: {
          client_id?: string | null
          name?: string
          type?: string
          type_custom?: string | null
          status?: string
          status_custom?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          postcode?: string | null
          cover_image_url?: string | null
          scope_description?: string | null
          scope_items?: Json
          phases?: Json
          template_id?: string | null
          pinterest_url?: string | null
          is_pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "projects_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          studio_id: string
          project_role: string
          added_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          studio_id: string
          project_role?: string
        }
        Update: {
          project_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          parent_task_id: string | null
          title: string
          description: string | null
          status: string
          priority: string
          phase_tag: string | null
          room_tag: string | null
          start_date: string | null
          due_date: string | null
          progress_percent: number
          is_recurring: boolean
          position: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          parent_task_id?: string | null
          title: string
          description?: string | null
          status?: string
          priority?: string
          phase_tag?: string | null
          room_tag?: string | null
          start_date?: string | null
          due_date?: string | null
          progress_percent?: number
          is_recurring?: boolean
          position?: number
          created_by?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          status?: string
          priority?: string
          phase_tag?: string | null
          room_tag?: string | null
          start_date?: string | null
          due_date?: string | null
          progress_percent?: number
          is_recurring?: boolean
          position?: number
          parent_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      task_assignees: {
        Row: {
          id: string
          task_id: string
          user_id: string
          studio_id: string
          assigned_at: string
          assigned_by_id: string | null
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          studio_id: string
          assigned_at?: string
          assigned_by_id?: string | null
        }
        Update: {
          assigned_by_id?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          studio_id: string
          author_id: string
          author_type: string
          body: string
          mentions: string[]
          is_client_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          studio_id: string
          author_id: string
          author_type?: string
          body: string
          mentions?: string[]
          is_client_visible?: boolean
        }
        Update: {
          body?: string
          is_client_visible?: boolean
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          id: string
          task_id: string
          studio_id: string
          uploaded_by_id: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size_bytes: number | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          task_id: string
          studio_id: string
          uploaded_by_id: string
          file_name: string
          file_url: string
          file_type?: string | null
          file_size_bytes?: number | null
        }
        Update: {
          file_name?: string
          file_url?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          id: string
          task_id: string
          depends_on_task_id: string
          studio_id: string
        }
        Insert: {
          id?: string
          task_id: string
          depends_on_task_id: string
          studio_id: string
        }
        Update: Record<string, never>
        Relationships: []
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
      seed_default_templates: {
        Args: { p_studio_id: string }
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
export type Client = Database["public"]["Tables"]["clients"]["Row"]
export type ProcessTemplate = Database["public"]["Tables"]["process_templates"]["Row"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"]
export type Task = Database["public"]["Tables"]["tasks"]["Row"]
