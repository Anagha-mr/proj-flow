import type { StudioRole } from "@/lib/supabase/types"

export type PermissionAction =
  | "view_financials"
  | "view_contract_values"
  | "view_studio_pl"
  | "manage_users"
  | "view_payroll"
  | "manage_settings"
  | "view_all_projects"
  | "manage_procurement"
  | "view_procurement_costs"
  | "view_client_details"
  | "manage_tasks"
  | "view_tasks"
  | "upload_documents"
  | "archive_documents"
  | "delete_documents"
  | "manage_document_access"
  | "manage_site"
  | "manage_billing"
  | "manage_rfis"
  | "manage_snags"
  | "manage_meetings"
  | "manage_contractors"
  | "log_time"
  | "view_all_time_entries"
  | "manage_stage_payments"
  | "manage_spec"
  | "manage_clients"
  | "manage_vendors"
  | "manage_purchase_orders"
  | "view_vendors"
  | "manage_portfolio"
  | "manage_moodboards"
  | "manage_team"
  | "manage_payroll"
  | "manage_studio"

export const ROLE_PERMISSIONS: Record<StudioRole, PermissionAction[]> = {
  owner: [
    "view_financials",
    "view_contract_values",
    "view_studio_pl",
    "manage_users",
    "view_payroll",
    "manage_settings",
    "view_all_projects",
    "manage_procurement",
    "view_procurement_costs",
    "view_client_details",
    "manage_tasks",
    "view_tasks",
    "upload_documents",
    "archive_documents",
    "delete_documents",
    "manage_document_access",
    "manage_site",
    "manage_billing",
    "manage_rfis",
    "manage_snags",
    "manage_meetings",
    "manage_contractors",
    "log_time",
    "view_all_time_entries",
    "manage_stage_payments",
    "manage_spec",
    "manage_clients",
    "manage_vendors",
    "manage_purchase_orders",
    "view_vendors",
    "manage_portfolio",
    "manage_moodboards",
    "manage_team",
    "manage_payroll",
    "manage_studio",
  ],
  senior_designer: [
    "view_financials",
    "view_all_projects",
    "manage_procurement",
    "view_procurement_costs",
    "view_client_details",
    "manage_tasks",
    "view_tasks",
    "upload_documents",
    "archive_documents",
    "manage_document_access",
    "manage_site",
    "manage_rfis",
    "manage_snags",
    "manage_meetings",
    "manage_contractors",
    "log_time",
    "view_all_time_entries",
    "manage_stage_payments",
    "manage_spec",
    "manage_clients",
    "manage_vendors",
    "manage_purchase_orders",
    "view_vendors",
    "manage_portfolio",
    "manage_moodboards",
    "manage_team",
  ],
  designer: [
    "manage_procurement",
    "view_client_details",
    "manage_tasks",
    "view_tasks",
    "upload_documents",
    "manage_rfis",
    "manage_snags",
    "manage_meetings",
    "log_time",
    "manage_spec",
    "view_vendors",
  ],
  intern: [
    "view_tasks",
    "log_time",
  ],
}

export function hasPermission(role: StudioRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false
}
