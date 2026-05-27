import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrderTracking, getProjectOrderSummary } from "@/app/actions/orders"
import { getVendors } from "@/app/actions/vendors"
import { OrdersTab } from "@/components/projects/orders/orders-tab"

export default async function ProjectOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  const [initialOrderTracking, initialOrderSummary, vendors] = await Promise.all([
    getOrderTracking(id).catch(() => []),
    getProjectOrderSummary(id).catch(() => ({
      total_orders: 0, delivered: 0, in_transit: 0, delayed: 0,
      total_value_ordered: 0, total_value_delivered: 0,
    })),
    getVendors().catch(() => []),
  ])

  return (
    <OrdersTab
      orderTracking={initialOrderTracking}
      orderSummary={initialOrderSummary}
      vendors={vendors}
      projectId={id}
    />
  )
}
