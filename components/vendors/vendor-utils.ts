export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

export const ORDER_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ordered:       { label: 'Ordered',       className: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'In Production', className: 'bg-purple-100 text-purple-700' },
  in_transit:    { label: 'In Transit',    className: 'bg-amber-100 text-amber-700' },
  customs_hold:  { label: 'Customs Hold',  className: 'bg-orange-100 text-orange-700' },
  delayed:       { label: 'Delayed',       className: 'bg-red-100 text-red-700' },
  delivered:     { label: 'Delivered',     className: 'bg-green-100 text-green-700' },
  installed:     { label: 'Installed',     className: 'bg-teal-100 text-teal-700' },
}

export const PO_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:               { label: 'Draft',               className: 'bg-slate-100 text-slate-600' },
  pending_approval:    { label: 'Pending Approval',     className: 'bg-amber-100 text-amber-700' },
  approved:            { label: 'Approved',             className: 'bg-green-100 text-green-700' },
  sent:                { label: 'Sent',                 className: 'bg-blue-100 text-blue-700' },
  confirmed_by_vendor: { label: 'Vendor Confirmed',     className: 'bg-teal-100 text-teal-700' },
  cancelled:           { label: 'Cancelled',            className: 'bg-red-100 text-red-700' },
}
