import type { Metadata } from "next"
import { getContractors } from "@/app/actions/contractors"
import { ContractorsClient } from "@/components/contractors/contractors-client"

export const metadata: Metadata = { title: "Contractors" }

export default async function ContractorsPage() {
  const contractors = await getContractors()
  return <ContractorsClient contractors={contractors} />
}
