import { createClient } from "@/lib/supabase/server"
import { getProjectContext, getConversationHistory } from "@/app/actions/ai"
import { buildSystemPrompt } from "@/lib/utils/ai-prompt"
import { NextRequest } from "next/server"
import type { Json } from "@/lib/supabase/types"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response("Unauthorized", { status: 401 })

    const { data: profile } = await supabase
      .from("users")
      .select("studio_id, name")
      .eq("id", user.id)
      .single()

    if (!profile?.studio_id) return new Response("Unauthorized", { status: 401 })

    // Check ai_enabled (column added in sprint 18 migration, not in generated types yet)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studio } = await (supabase.from as any)("studios")
      .select("name, ai_enabled")
      .eq("id", profile.studio_id)
      .single() as { data: { name: string; ai_enabled: boolean } | null }

    if (studio?.ai_enabled === false) {
      return new Response("AI assistant is disabled", { status: 403 })
    }

    // ── Parse body ──────────────────────────────────────────
    const { conversationId, projectId, userMessage } = await req.json()

    if (!userMessage?.trim()) {
      return new Response("Message required", { status: 400 })
    }

    // ── Load context + history ──────────────────────────────
    const [history, projectContext] = await Promise.all([
      getConversationHistory(conversationId),
      projectId ? getProjectContext(projectId) : Promise.resolve(null),
    ])

    const systemPrompt = buildSystemPrompt(
      projectContext,
      studio?.name ?? "Your Studio",
      profile.name ?? "there"
    )

    // ── Build messages for Groq ─────────────────────────────
    const recentHistory = history.slice(-20)
    const groqMessages = recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
    groqMessages.push({ role: "user", content: userMessage })

    // ── Call Groq API ───────────────────────────────────────
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...groqMessages,
        ],
      }),
    })

    if (!groqResponse.ok) {
      const err = await groqResponse.text()
      console.error("Groq API error:", err)
      return new Response("AI service error", { status: 502 })
    }

    // ── Stream response back to client ──────────────────────
    let fullText = ""

    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body!.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n").filter((l) => l.trim())

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  fullText += delta
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ type: "text_delta", delta })}\n\n`
                    )
                  )
                }
              } catch {
                // skip malformed chunks
              }
            }
          }

          // ── Parse action proposal from full response ────────
          const actionMatch = fullText.match(/<action>([\s\S]*?)<\/action>/)
          const visibleText = fullText.replace(/<action>[\s\S]*?<\/action>/g, "").trim()

          let actionProposal = null
          if (actionMatch) {
            try {
              actionProposal = JSON.parse(actionMatch[1])
            } catch {
              // malformed action tag — ignore
            }
          }

          // ── Persist messages to DB ──────────────────────────
          const { data: convo } = await supabase
            .from("ai_conversations")
            .select("messages")
            .eq("id", conversationId)
            .single()

          const existingMessages = (convo?.messages as unknown[]) ?? []
          const userMsg = {
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
          }
          const assistantMsg = {
            role: "assistant",
            content: visibleText,
            timestamp: new Date().toISOString(),
            ...(actionProposal ? { action_proposal: { ...actionProposal, status: "pending" } } : {}),
          }

          await supabase
            .from("ai_conversations")
            .update({ messages: [...existingMessages, userMsg, assistantMsg] as unknown as Json })
            .eq("id", conversationId)

          // ── Send action + done events ───────────────────────
          if (actionProposal) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "action", payload: { ...actionProposal, status: "pending" } })}\n\n`
              )
            )
          }

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: "done" })}\n\n`
            )
          )
          controller.close()

        } catch (err) {
          console.error("Stream error:", err)
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: "error", message: "Stream failed" })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })

  } catch (err) {
    console.error("AI chat route error:", err)
    return new Response("Internal server error", { status: 500 })
  }
}