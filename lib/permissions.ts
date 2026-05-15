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
  ],
  intern: [
    "view_tasks",
  ],
}

export function hasPermission(role: StudioRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false
}
