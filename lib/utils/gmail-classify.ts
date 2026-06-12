// Non-async utility — safe for use in both server actions and API routes.
// Builds the Groq prompt for batch email classification.

export interface EmailMetadata {
  message_id: string
  from_email: string
  from_name: string
  subject: string
  snippet: string
}

export interface StudioContact {
  email: string
  name: string
  type: 'client' | 'vendor' | 'contractor'
  project_ids: string[]
  project_names: string[]
}

export interface StudioContacts {
  clients: StudioContact[]
  vendors: StudioContact[]
  contractors: StudioContact[]
}

export function buildGmailClassificationPrompt(
  emails: EmailMetadata[],
  contacts: StudioContacts
): string {
  const allContacts = [
    ...contacts.clients.map((c) => ({ ...c, type: 'client' })),
    ...contacts.vendors.map((c) => ({ ...c, type: 'vendor' })),
    ...contacts.contractors.map((c) => ({ ...c, type: 'contractor' })),
  ]

  const contactsJson = JSON.stringify(allContacts, null, 2)
  const emailsJson = JSON.stringify(
    emails.map((e) => ({
      message_id: e.message_id,
      from_email: e.from_email,
      from_name: e.from_name,
      subject: e.subject,
      snippet: e.snippet,
    })),
    null,
    2
  )

  const systemPrompt = `You are a classification engine for an interior design studio management platform. Your job is to classify emails by intent and suggest an action for the studio team.

Classification options:
- client_approval: Client may be approving or responding to a procurement item or proposal
- vendor_quote: A vendor/supplier is sending a quote or price information
- contractor_query: A contractor is asking a question or raising an issue
- invoice_query: Someone is asking about an invoice or payment
- site_update: A site-related update or report
- general: Does not fit any above category or confidence is low

Action type options:
- update_procurement_approval: Suggest updating a procurement item approval status
- create_quote_response: Suggest logging a quote response from a vendor
- create_task: Suggest creating a follow-up task
- update_invoice_status: Suggest reviewing an invoice (creates reminder task only)
- log_site_update: Suggest logging a site update
- no_action: No clear action; classification is general or confidence is low

Rules:
- If classification is "general" or confidence is low: use suggested_action_type "no_action"
- project_id should be the UUID of the most likely related project, or null if cannot be inferred
- suggested_action_data must match the action type:
  - update_procurement_approval: { item_id, item_name, new_approval_status, project_id, project_name }
  - create_quote_response: { vendor_id, vendor_name, project_id, procurement_item_id, suggested_price }
  - create_task: { title, project_id, suggested_due_days }
  - update_invoice_status: { invoice_id, invoice_number, client_name, amount }
  - log_site_update or no_action: {}
- Return ONLY a JSON object with key "results" containing an array. No markdown, no preamble.`

  const userPrompt = `Known studio contacts:
${contactsJson}

Emails to classify:
${emailsJson}

For each email, return a classification result. Match sender emails against known contacts to infer project associations.`

  return `${systemPrompt}\n\n${userPrompt}`
}
