"use client"

export function GmailConnectPrompt() {
  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[10px]"
      style={{ border: "1px dashed var(--color-border-emphasis, rgba(255,255,255,0.20))" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">📧</span>
        <div>
          <p className="text-[13px] font-medium" style={{ color: "var(--color-text-primary, inherit)" }}>
            Connect Gmail to surface AI suggestions from your inbox
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary, rgba(255,255,255,0.55))" }}>
            Emails from clients, vendors, and contractors are classified automatically — no action taken without you.
          </p>
        </div>
      </div>
      <a
        href="/api/gmail/auth"
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors"
        style={{
          background: "var(--color-accent, #e94560)",
          color: "#fff",
        }}
      >
        Connect Gmail →
      </a>
    </div>
  )
}
