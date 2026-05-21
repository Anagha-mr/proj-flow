"use client"

import { useState } from "react"
import { CheckIcon, CornerUpLeftIcon } from "lucide-react"

export function MoodboardActionPanel({
  shareToken,
}: {
  shareToken: string
}) {
  const [name, setName] = useState("")
  const [feedback, setFeedback] = useState("")
  const [nameError, setNameError] = useState("")
  const [feedbackError, setFeedbackError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: "approve" | "revision"; displayName: string } | null>(null)

  async function submit(action: "approve" | "request_revision") {
    setNameError("")
    setFeedbackError("")

    if (!name.trim()) {
      setNameError("Please enter your name")
      return
    }
    if (action === "request_revision" && !feedback.trim()) {
      setFeedbackError("Please describe what changes you'd like before requesting a revision")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/moodboards/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_token: shareToken,
          action,
          name: name.trim(),
          feedback: feedback.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? "Something went wrong. Please try again.")
        return
      }

      setResult({ type: action === "approve" ? "approve" : "revision", displayName: name.trim() })
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    if (result.type === "approve") {
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mx-auto" style={{ maxWidth: 480 }}>
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckIcon className="w-5 h-5 text-green-600" />
          </div>
          <p className="font-semibold text-green-800 text-lg">
            Thank you, {result.displayName}!
          </p>
          <p className="text-green-700 text-sm mt-1">
            Your approval has been recorded. The design team has been notified.
          </p>
        </div>
      )
    }
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mx-auto" style={{ maxWidth: 480 }}>
        <p className="font-semibold text-amber-800">Revision request sent.</p>
        <p className="text-amber-700 text-sm mt-1">
          The design team will be in touch shortly.
        </p>
      </div>
    )
  }

  return (
    <div
      className="bg-white shadow-md rounded-xl p-6 mx-auto"
      style={{ maxWidth: 480 }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Your name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560]"
          />
          {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Feedback{" "}
            <span className="text-gray-400 font-normal">
              (optional for approval, required for revision)
            </span>
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Share your thoughts on this design…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560] resize-none"
          />
          {feedbackError && <p className="text-red-500 text-xs mt-1">{feedbackError}</p>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => submit("approve")}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            <CheckIcon className="w-4 h-4" />
            Approve Design
          </button>

          <button
            onClick={() => submit("request_revision")}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors bg-white disabled:opacity-60"
          >
            <CornerUpLeftIcon className="w-4 h-4" />
            Request Revision
          </button>
        </div>
      </div>
    </div>
  )
}
