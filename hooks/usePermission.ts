"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { hasPermission, type PermissionAction } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"

export function usePermission(action: PermissionAction): boolean {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAllowed(false); return }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (data?.role) {
        setAllowed(hasPermission(data.role as StudioRole, action))
      }
    }

    check()
  }, [action])

  return allowed
}
