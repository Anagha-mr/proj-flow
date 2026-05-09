"use client"

import { usePermission } from "@/hooks/usePermission"
import type { PermissionAction } from "@/lib/permissions"

interface PermissionGateProps {
  action: PermissionAction
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ action, children, fallback = null }: PermissionGateProps) {
  const allowed = usePermission(action)
  return allowed ? <>{children}</> : <>{fallback}</>
}
