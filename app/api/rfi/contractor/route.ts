// POST /api/rfi/contractor
// Public — no auth required. Called from contractor no-login view.

import { NextRequest, NextResponse } from "next/server"
import { createAnnotatedRFIFromContractor } from "@/app/actions/rfis"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contractorToken, projectId, documentId, title, description, annotationData, spaceTag } = body

    if (!contractorToken || !projectId || !documentId || !title || !annotationData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await createAnnotatedRFIFromContractor({
      contractorToken,
      projectId,
      documentId,
      title,
      description: description ?? "",
      annotationData,
      spaceTag: spaceTag ?? undefined,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("Contractor RFI error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
