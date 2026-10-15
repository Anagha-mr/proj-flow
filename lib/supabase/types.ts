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
          wati_api_key: string | null
          wati_api_url: string | null
          resend_api_key: string | null
          sending_email: string | null
          sending_email_name: string | null
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
          wati_api_key?: string | null
          wati_api_url?: string | null
          resend_api_key?: string | null
          sending_email?: string | null
          sending_email_name?: string | null
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
          wati_api_key?: string | null
          wati_api_url?: string | null
          resend_api_key?: string | null
          sending_email?: string | null
          sending_email_name?: string | null
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
          contract_value: number | null
          portfolio_summary: string | null
          portfolio_key_decisions: string | null
          portfolio_location_city: string | null
          portfolio_year_completed: number | null
          portfolio_published: boolean
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
          contract_value?: number | null
          portfolio_summary?: string | null
          portfolio_key_decisions?: string | null
          portfolio_location_city?: string | null
          portfolio_year_completed?: number | null
          portfolio_published?: boolean
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
          contract_value?: number | null
          portfolio_summary?: string | null
          portfolio_key_decisions?: string | null
          portfolio_location_city?: string | null
          portfolio_year_completed?: number | null
          portfolio_published?: boolean
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
          reviewer_id: string | null
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
          reviewer_id?: string | null
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
          reviewer_id?: string | null
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
          },
          {
            foreignKeyName: "tasks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      review_logs: {
        Row: {
          id: string
          task_id: string
          reviewer_id: string | null
          studio_id: string
          outcome: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          reviewer_id?: string | null
          studio_id: string
          outcome: string
          notes?: string | null
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: "review_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_studio_id_fkey"
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
      documents: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          name: string
          category: string
          file_url: string
          file_type: string
          file_size_bytes: number | null
          version_number: number
          version_status: string
          access_level: string
          uploaded_by_id: string
          previous_version_id: string | null
          share_token: string
          share_token_expires_at: string | null
          share_enabled: boolean
          description: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          name: string
          category: string
          file_url: string
          file_type: string
          file_size_bytes?: number | null
          version_number?: number
          version_status?: string
          access_level?: string
          uploaded_by_id: string
          previous_version_id?: string | null
          share_token?: string
          share_token_expires_at?: string | null
          share_enabled?: boolean
          description?: string | null
          tags?: string[] | null
        }
        Update: {
          name?: string
          category?: string
          file_url?: string
          file_type?: string
          file_size_bytes?: number | null
          version_number?: number
          version_status?: string
          access_level?: string
          previous_version_id?: string | null
          share_token_expires_at?: string | null
          share_enabled?: boolean
          description?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      document_access_logs: {
        Row: {
          id: string
          document_id: string
          studio_id: string
          accessed_by_type: string
          accessed_by_id: string | null
          accessed_at: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          document_id: string
          studio_id: string
          accessed_by_type: string
          accessed_by_id?: string | null
          accessed_at?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      procurement_schedules: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          name: string
          view_type: string
          status: string
          owner_id: string | null
          is_client_published: boolean
          shared_with: Json
          is_archived: boolean
          client_can_view_supplier: boolean
          client_can_view_brand: boolean
          client_can_view_pricing: boolean
          client_can_view_details: boolean
          client_can_approve: boolean
          share_token: string
          share_token_expires_at: string | null
          share_enabled: boolean
          created_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          name?: string
          view_type?: string
          status?: string
          owner_id?: string | null
          is_client_published?: boolean
          shared_with?: Json
          is_archived?: boolean
          client_can_view_supplier?: boolean
          client_can_view_brand?: boolean
          client_can_view_pricing?: boolean
          client_can_view_details?: boolean
          client_can_approve?: boolean
          share_token?: string
          share_token_expires_at?: string | null
          share_enabled?: boolean
          created_by_id?: string | null
        }
        Update: {
          name?: string
          view_type?: string
          status?: string
          owner_id?: string | null
          is_client_published?: boolean
          shared_with?: Json
          is_archived?: boolean
          client_can_view_supplier?: boolean
          client_can_view_brand?: boolean
          client_can_view_pricing?: boolean
          client_can_view_details?: boolean
          client_can_approve?: boolean
          share_token_expires_at?: string | null
          share_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "procurement_schedules_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_schedules_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      procurement_items: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          schedule_id: string
          room_or_category: string | null
          name: string
          description: string | null
          product_code: string | null
          brand: string | null
          supplier_name: string | null
          source_url: string | null
          dimensions_length: number | null
          dimensions_height: number | null
          dimensions_depth: number | null
          dimensions_unit: string
          finish: string | null
          material: string | null
          quantity: number
          unit_cost: number
          total_cost: number
          image_url: string | null
          quotation_attachment_url: string | null
          in_stock: boolean | null
          is_flagged: boolean
          is_archived: boolean
          position: number
          created_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          schedule_id: string
          room_or_category?: string | null
          name: string
          description?: string | null
          product_code?: string | null
          brand?: string | null
          supplier_name?: string | null
          source_url?: string | null
          dimensions_length?: number | null
          dimensions_height?: number | null
          dimensions_depth?: number | null
          dimensions_unit?: string
          finish?: string | null
          material?: string | null
          quantity?: number
          unit_cost?: number
          image_url?: string | null
          quotation_attachment_url?: string | null
          in_stock?: boolean | null
          is_flagged?: boolean
          is_archived?: boolean
          position?: number
          created_by_id?: string | null
        }
        Update: {
          room_or_category?: string | null
          name?: string
          description?: string | null
          product_code?: string | null
          brand?: string | null
          supplier_name?: string | null
          source_url?: string | null
          dimensions_length?: number | null
          dimensions_height?: number | null
          dimensions_depth?: number | null
          dimensions_unit?: string
          finish?: string | null
          material?: string | null
          quantity?: number
          unit_cost?: number
          image_url?: string | null
          quotation_attachment_url?: string | null
          in_stock?: boolean | null
          is_flagged?: boolean
          is_archived?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_items_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_items_schedule_id_fkey"
            columns: ["schedule_id"]
            referencedRelation: "procurement_schedules"
            referencedColumns: ["id"]
          }
        ]
      }
      procurement_item_status: {
        Row: {
          id: string
          item_id: string
          studio_id: string
          curation_status: string
          client_approval_status: string
          procurement_status: string
          payment_status: string
          client_comment: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          studio_id: string
          curation_status?: string
          client_approval_status?: string
          procurement_status?: string
          payment_status?: string
          client_comment?: string | null
        }
        Update: {
          curation_status?: string
          client_approval_status?: string
          procurement_status?: string
          payment_status?: string
          client_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_item_status_item_id_fkey"
            columns: ["item_id"]
            referencedRelation: "procurement_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_item_status_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          client_id: string
          invoice_number: string
          line_items: Json
          subtotal: number
          gst_amount: number
          total: number
          status: string
          issue_date: string
          due_date: string | null
          sent_at: string | null
          reminder_sent_at: string[] | null
          notes: string | null
          created_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          client_id: string
          invoice_number: string
          line_items?: Json
          subtotal?: number
          gst_amount?: number
          total?: number
          status?: string
          issue_date?: string
          due_date?: string | null
          sent_at?: string | null
          reminder_sent_at?: string[] | null
          notes?: string | null
          created_by_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          invoice_number?: string
          line_items?: Json
          subtotal?: number
          gst_amount?: number
          total?: number
          status?: string
          issue_date?: string
          due_date?: string | null
          sent_at?: string | null
          reminder_sent_at?: string[] | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      invoice_payments: {
        Row: {
          id: string
          invoice_id: string
          studio_id: string
          amount: number
          payment_date: string
          bank_reference: string | null
          notes: string | null
          recorded_by_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          studio_id: string
          amount: number
          payment_date: string
          bank_reference?: string | null
          notes?: string | null
          recorded_by_id?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          payment_date?: string
          bank_reference?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      expense_entries: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          reference: string | null
          recorded_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          category: string
          description: string
          amount: number
          expense_date?: string
          reference?: string | null
          recorded_by_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          category?: string
          description?: string
          amount?: number
          expense_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_messages: {
        Row: {
          id: string
          studio_id: string
          recipient_type: string
          recipient_id: string
          template_id: string
          variables: Json
          status: string
          sent_at: string | null
          project_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          recipient_type: string
          recipient_id: string
          template_id: string
          variables?: Json
          status?: string
          sent_at?: string | null
          project_id?: string | null
          created_at?: string
        }
        Update: {
          status?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_studio_id_fkey"
            columns: ["studio_id"]
            referencedRelation: "studios"
            referencedColumns: ["id"]
          }
        ]
      }
      site_updates: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          submitted_by_type: string
          submitted_by_id: string
          photos: string[]
          space_tag: string | null
          phase_tag: string | null
          status_note: string | null
          is_client_visible: boolean
          offline_queued: boolean
          submitted_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          submitted_by_type: string
          submitted_by_id: string
          photos?: string[]
          space_tag?: string | null
          phase_tag?: string | null
          status_note?: string | null
          is_client_visible?: boolean
          offline_queued?: boolean
          submitted_at?: string
        }
        Update: {
          photos?: string[]
          space_tag?: string | null
          phase_tag?: string | null
          status_note?: string | null
          is_client_visible?: boolean
          offline_queued?: boolean
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          studio_id: string
          event_type: string
          in_app: boolean
          email: boolean
          whatsapp: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          studio_id: string
          event_type: string
          in_app?: boolean
          email?: boolean
          whatsapp?: boolean
        }
        Update: {
          in_app?: boolean
          email?: boolean
          whatsapp?: boolean
        }
        Relationships: []
      }
      contractors: {
        Row: {
          id: string
          studio_id: string
          company_name: string
          company_type: string | null
          contact_name: string
          phone: string
          email: string | null
          whatsapp_number: string | null
          address: string | null
          gstin: string | null
          tax_bracket: string | null
          site_supervisor_name: string | null
          site_supervisor_phone: string | null
          contractor_token: string
          contractor_token_expires_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          company_name: string
          company_type?: string | null
          contact_name: string
          phone: string
          email?: string | null
          whatsapp_number?: string | null
          address?: string | null
          gstin?: string | null
          tax_bracket?: string | null
          site_supervisor_name?: string | null
          site_supervisor_phone?: string | null
          contractor_token?: string
          contractor_token_expires_at?: string | null
          is_active?: boolean
        }
        Update: {
          company_name?: string
          company_type?: string | null
          contact_name?: string
          phone?: string
          email?: string | null
          whatsapp_number?: string | null
          address?: string | null
          gstin?: string | null
          tax_bracket?: string | null
          site_supervisor_name?: string | null
          site_supervisor_phone?: string | null
          contractor_token?: string
          contractor_token_expires_at?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      project_contractors: {
        Row: {
          id: string
          project_id: string
          contractor_id: string
          studio_id: string
          scope_notes: string | null
          assigned_at: string
        }
        Insert: {
          id?: string
          project_id: string
          contractor_id: string
          studio_id: string
          scope_notes?: string | null
          assigned_at?: string
        }
        Update: {
          scope_notes?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          title: string
          meeting_type: string
          meeting_date: string
          start_time: string | null
          end_time: string | null
          location: string | null
          attendees: Json
          agenda: string | null
          minutes: string | null
          action_items: Json
          created_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          title: string
          meeting_type: string
          meeting_date: string
          start_time?: string | null
          end_time?: string | null
          location?: string | null
          attendees?: Json
          agenda?: string | null
          minutes?: string | null
          action_items?: Json
          created_by_id?: string | null
        }
        Update: {
          title?: string
          meeting_type?: string
          meeting_date?: string
          start_time?: string | null
          end_time?: string | null
          location?: string | null
          attendees?: Json
          agenda?: string | null
          minutes?: string | null
          action_items?: Json
        }
        Relationships: []
      }
      rfis: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          contractor_id: string | null
          ref_number: string
          raised_by_type: string
          raised_by_id: string
          title: string
          description: string
          linked_document_id: string | null
          space_tag: string | null
          status: string
          response_deadline: string
          response_text: string | null
          responded_by_id: string | null
          responded_at: string | null
          escalated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          contractor_id?: string | null
          ref_number: string
          raised_by_type: string
          raised_by_id: string
          title: string
          description: string
          linked_document_id?: string | null
          space_tag?: string | null
          status?: string
          response_deadline: string
          response_text?: string | null
          responded_by_id?: string | null
          responded_at?: string | null
          escalated_at?: string | null
        }
        Update: {
          status?: string
          response_text?: string | null
          responded_by_id?: string | null
          responded_at?: string | null
          escalated_at?: string | null
        }
        Relationships: []
      }
      portfolio_gallery_items: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          image_url: string
          caption: string | null
          space_tag: string | null
          display_order: number
          include_in_export: boolean
          uploaded_by_id: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          image_url: string
          caption?: string | null
          space_tag?: string | null
          display_order?: number
          include_in_export?: boolean
          uploaded_by_id?: string | null
          uploaded_at?: string
        }
        Update: {
          image_url?: string
          caption?: string | null
          space_tag?: string | null
          display_order?: number
          include_in_export?: boolean
        }
        Relationships: []
      }
      snag_items: {
        Row: {
          id: string
          studio_id: string
          project_id: string
          photo_url: string
          location_description: string
          plan_reference: string | null
          plan_reference_document_id: string | null
          description: string
          assigned_to_type: string
          assigned_to_id: string
          due_date: string | null
          status: string
          resolution_photo_url: string | null
          resolution_note: string | null
          client_signed_off_at: string | null
          client_signed_off_by: string | null
          created_by_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          project_id: string
          photo_url: string
          location_description: string
          plan_reference?: string | null
          plan_reference_document_id?: string | null
          description: string
          assigned_to_type: string
          assigned_to_id: string
          due_date?: string | null
          status?: string
          resolution_photo_url?: string | null
          resolution_note?: string | null
          created_by_id?: string | null
        }
        Update: {
          photo_url?: string
          location_description?: string
          plan_reference?: string | null
          plan_reference_document_id?: string | null
          description?: string
          assigned_to_type?: string
          assigned_to_id?: string
          due_date?: string | null
          status?: string
          resolution_photo_url?: string | null
          resolution_note?: string | null
          client_signed_off_at?: string | null
          client_signed_off_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snag_items_plan_reference_document_id_fkey"
            columns: ["plan_reference_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_conversations: {
        Row: {
          id: string
          studio_id: string
          user_id: string
          project_id: string | null
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          user_id: string
          project_id?: string | null
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          messages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
