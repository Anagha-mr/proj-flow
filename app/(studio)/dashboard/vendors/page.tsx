import type { Metadata } from "next"
import { getVendors } from "@/app/actions/vendors"
import { getPurchaseOrdersAll } from "@/app/actions/purchase-orders"
import { VendorsPageClient } from "@/components/vendors/vendors-page-client"

export const metadata: Metadata = { title: "Vendors" }

export default async function VendorsPage() {
  const [vendors, purchaseOrders] = await Promise.all([
    getVendors(),
    getPurchaseOrdersAll(),
  ])
  return <VendorsPageClient vendors={vendors} purchaseOrders={purchaseOrders} />
}
