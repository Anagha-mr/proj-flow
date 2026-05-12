export function computeGst(
  studioStateCode: string,
  clientStateCode: string,
  amount: number,
  gstRate: number
): { cgst: number; sgst: number; igst: number; gstAmount: number } {
  const isIntraState = studioStateCode === clientStateCode
  const gstAmount = Math.round((amount * gstRate) / 100)
  if (isIntraState) {
    const half = Math.round(gstAmount / 2)
    return { cgst: half, sgst: gstAmount - half, igst: 0, gstAmount }
  }
  return { cgst: 0, sgst: 0, igst: gstAmount, gstAmount }
}
