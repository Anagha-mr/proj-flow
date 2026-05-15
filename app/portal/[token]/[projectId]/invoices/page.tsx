import Link from "next/link"
import { getPortalInvoices } from "@/app/actions/client-portal"

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export default async function PortalInvoicesPage({
  params,
}: {
  params: Promise<{ token: string; projectId: string }>
}) {
  const { token, projectId } = await params

  let invoices: Awaited<ReturnType<typeof getPortalInvoices>> = []
  try {
    const all = await getPortalInvoices(token)
    // The server action returns all projects' invoices — no project filter available on the type
    // Since getPortalInvoices doesn't filter by projectId, we show all invoices
    invoices = all
  } catch {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Unable to load invoices. Please contact your designer.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/portal/${token}/${projectId}`} className="text-[#e94560] text-sm hover:underline">
          ← Back to project
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">
          No invoices yet.
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{inv.invoice_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status] ?? STATUS_BADGE.sent}`}>
                    {inv.status}
                  </span>
                </div>
                <a
                  href={`/api/finance/invoice-pdf?invoiceId=${inv.id}&portalToken=${token}`}
                  className="text-sm text-[#e94560] hover:underline font-medium"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF →
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Issue Date</p>
                  <p className="font-medium text-gray-800">{formatDate(inv.issue_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Due Date</p>
                  <p className={`font-medium ${inv.status === "overdue" ? "text-red-600" : "text-gray-800"}`}>
                    {formatDate(inv.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-medium text-gray-800">{formatINR(inv.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Amount Due</p>
                  <p className={`font-medium ${inv.amount_due > 0 ? "text-[#e94560]" : "text-green-600"}`}>
                    {formatINR(inv.amount_due)}
                  </p>
                </div>
              </div>
              {inv.amount_paid > 0 && (
                <p className="text-xs text-green-600 mt-2">
                  Paid: {formatINR(inv.amount_paid)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
