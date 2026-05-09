# CONTEXT.md — ProjectFlow Master Product & Developer Guideline
> Version 3.0 | Interior Design Studio Management Platform | Confidential
> This is the single source of truth for the ProjectFlow build. Claude Code should read this file at the start of every sprint session.

---

## QUICK REFERENCE FOR CLAUDE CODE

- **Product:** ProjectFlow — All-in-one studio OS for Indian interior design & architecture firms
- **Stack:** Next.js 14 + TypeScript, shadcn/ui + Tailwind, Supabase (Postgres + Auth + Storage + RLS), Wati.io (WhatsApp), Puppeteer (PDF), Resend (email), Razorpay (billing)
- **Multi-tenancy:** Every table has `studio_id`. Supabase RLS enforces strict studio isolation.
- **External users (clients, contractors, vendors):** No login, no account — token-based links only
- **Phase 0 target:** 8 sprints, ~8 weeks. Must be fully working before Phase 1 begins.

---

## TARGET MARKET & BUSINESS MODEL

- **Target:** Indian interior design & architecture firms, 2–20 people, 3–15 active projects
- **Business model:** SaaS + Done-For-You service
- **Pricing:** Monthly INR subscription (Starter ₹4,999 / Pro ₹9,999 / Scale ₹18,999)
- **Primary cities:** Bengaluru, Mumbai, Delhi-NCR, Hyderabad, Pune

---

## THE PROBLEM BEING SOLVED

Most Indian ID firms run on WhatsApp + Excel + phone calls. This causes:
- No audit trail on decisions or approvals
- Drawing version confusion on site
- Procurement chaos and budget overruns
- No real-time financial visibility
- Client anxiety from lack of updates
- Contractor disputes with no formal record

---

## FIVE USER PERSONAS

| Persona | Profile | Core Need |
|---|---|---|
| Studio Principal / Owner | Firm owner, accountable for all delivery and revenue | Portfolio dashboard, studio P&L, resource allocation, instant financial overview |
| Project Designer / Lead | Day-to-day execution, 2–4 projects simultaneously | Task board, document version control, procurement flow, time tracking |
| Client | Paying ₹10L–₹5Cr+, anxious about money and timeline | Branded portal, procurement approvals, invoice history, weekly WhatsApp updates |
| Contractor / Site Supervisor | Mobile-only, low digital literacy, on site | Latest drawings only, simple daily update form, RFI log, stage payment visibility |
| Vendor / Supplier | Receives POs, ships product | Receive PO via WhatsApp link, confirm receipt, update delivery status — no app download |

---

## INFORMATION ARCHITECTURE

### Studio Layer (internal — desktop optimised)
| Module | Key Actions |
|---|---|
| 🏠 Dashboard | Portfolio overview, studio health scores, notification centre, resource load |
| 📁 Projects | Project list, task board (Kanban/List/Gantt), document centre, procurement & approvals, project finance, site tracking, meetings, snag list, RFI tracker |
| 👥 Clients | Client list, approval centre, invoice centre, communication log |
| 🏗 Contractors | Contractor list, queries tracker, RFI log, stage payments, drawing access log |
| 🏪 Vendors | Vendor list, product library, quote requests, PO centre, payment tracking |
| 💰 Finance | Studio P&L, outstanding payments, GST summary, invoice list |
| 🏢 Studio | Team profiles, payroll, leave tracker, expense claims, SOPs, process templates |
| 📊 Portfolio | All projects grid, cross-project timeline, resource allocation map |
| 📣 Marketing | (Phase 3) Social scheduler, Instagram grid planner, blog templates |
| ⚙️ Settings | Studio profile, GSTIN + tax config, roles & permissions, notification preferences, WhatsApp integration |

### External Layer (no login — token-based)
| View | User | Can Do |
|---|---|---|
| Client Portal | Client (unique token link) | View project status, approve procurement, view invoices, view site photos, ask questions |
| Contractor View | Contractor (unique token link) | View latest drawings, submit daily site update, raise RFI, view BOQ, confirm delivery |
| Vendor Form | Vendor (link via WhatsApp) | Submit quote, confirm PO receipt, update delivery status |
| Procurement Share | Any stakeholder (QR/link) | View approved schedule, download PDF |

---

## COMPLETE FEATURE SPECIFICATION

### 5.1 PROJECT MANAGEMENT

**Projects Landing Page**
- Grid/list view of all projects as tiles — cover image, project name, client name, status badge, project type, timeline progress bar, assigned team avatars
- Per-tile 3-dot menu: Edit (right side panel), Duplicate, Copy to, Pin to top, Archive, Delete
- Filter: status (Active/On Hold/Completed/Archived), project type, team member, date range
- Sort: last updated (default), project name, start date, contract value
- Search across all projects by name, client, address

**Project Setup — Details Side Panel**
- Cover image: drag-and-drop upload
- Project name, type (Residential/Commercial/Hospitality/Retail/Other + custom), status
- Project address: 3 lines + postcode
- Currency (default INR), measurement units, GST tax bracket — owner/manager only
- Full scope of work + itemised deliverables list
- Project phases with start/end dates: Concept → Design Development → Procurement → Execution → Handover (all customisable)
- Team assignment with project-specific roles
- Link client profile — triggers welcome WhatsApp on save
- Select and apply a studio process template — tasks auto-populate

**Project Overview (per project dashboard)**
- Task summary card: Total / Completed / In Progress / Pending (colour-coded)
- Total budget card: contract value, spent to date, remaining — owner/manager only
- Expenses to date card — owner/manager only
- Upcoming tasks widget: top 3 next-due tasks
- Latest documents widget: latest-issued version only

**Task Management**
- Three views: Kanban / List / Timeline (Gantt) — preference saved per project
- Status cards at top: To Do (pink), In Progress (blue), Completed (green)
- Task grouping: by phase, room/space, assignee, status, priority
- Colour-coded group labels
- Tags, custom fields, adjustable column widths
- Inline edit on all fields
- Right-click / 3-dot menu per task: Edit, Duplicate, Add sub-task, Add custom field, Add tag, Change colour, Delete
- Export task list to PDF

**Task Row displays:** main category / task group / task name, sub-tasks nested, phase tag, owner avatar, due date, priority badge (High/Medium/Low), status, progress % bar

**Task Dialogue Box (right-side panel)**
- Fields: category, task name, sub-task name, status, start date, deadline, duration (auto-calculated), description (rich text)
- Multiple assignees — each with profile, role, availability, active task count
- Task dependencies — dependency chain on Gantt
- Progress % — manual or auto from sub-task completion
- Attachments: JPEG, PNG, SKP, Excel, PDF, DWG
- Approvals within task: assign Approve/Revise/Reject to internal user or client
- Comments: separate threads for internal team and client
- Actions: Save, Delete, Share task

**Timeline (Gantt) View**
- Grouped by main category → task group → task, sub-tasks indented
- Horizontal scroll (timeline) + vertical scroll (task list) simultaneously
- Time range filter: Today/Week/Month/Quarter/6 Months/Year/Custom
- Drag bars to reschedule — dependencies auto-update
- Milestones as diamond markers
- Critical path highlighting

**Document Centre**
- Upload any file type: JPEG, PNG, SKP, Excel, PDF, DWG
- Categories: Drawings / Specifications / Site Photos / Contracts / Reports / Client Shared / Contractor Shared
- Drawing version control: each re-upload creates new version (v1, v2, v3...)
- "Latest Issued" flag — setting new version as latest auto-supersedes previous
- Superseded versions archived, never deleted — internal only; contractors and clients see latest only
- Access control per file: Internal only / Client-visible / Contractor-visible / Public link
- Share via unique link or QR code — optional expiry date
- Document log: uploaded by, at, version, access level, shared with list
- Drawing access log: exact timestamp when contractor last viewed each drawing

**Procurement & Approvals — 4-tab structure**

*Summary Tab:*
- Lists all schedules as files — sortable alphabetically, by status, last updated
- Per schedule row: name, type, shared with, owner, status, last updated
- Create from template (Furniture Schedule, Lighting Schedule, Finishes Schedule)
- Toolbar: Show/Hide Archived, Copy To, Import Schedule, Create PO, Export PDF/Excel

*Product List (within each schedule):*
- Toggle: Room-based view / Schedule-based view
- Per product row: image thumbnail, name, description, product code, brand, supplier (linked to vendor), dimensions (L×H×D with unit toggle), finish, quantity, material, unit cost, total cost, quotation attachment, in stock indicator
- Product detail side tray (right panel, inline edit)

*Product Import Options:*
- Manual entry
- Add from URL — AI auto-fills name, description, dimensions, brand, image
- Add from Product Library
- (Phase 2) Web clipper browser extension

*Product Item Actions (3-dot menu):*
- Add flag, Archive, Add to Product Library, Duplicate, Copy to, Move to section, Export to PDF spec sheet, Update from URL, Remove from Schedule

*Review Status System (4 independent tracks per product):*
- Curation status: Draft / Hidden / Quoting / Selected / Internal Review / Internally Approved
- Client Approval status: Client Review / Approved / Rejected / Re-submit / Closed
- Procurement status: Ordered / In Production / In Transit / Delivered / Installed
- Payment status: Invoiced / Payment Due / Partial Payment / Paid
- Custom status option per track

*Financial Tab:*
- Total trade price, total tax, total trade discounts
- Per-schedule/per-group pricing totals
- Approved items auto-pull into project finance running cost tracker
- Export as branded GST-formatted PDF with studio logo, GSTIN, item list, costs, GST breakdown

*Approvals Tab:*
- All products filtered/sorted by approval status
- Client approval workflow: Approve / Request Revision / Decline (comment required if revising/declining)
- Designer notified via in-app + WhatsApp on client action

*Sharing & Permissions:*
- Share individual or multiple schedules
- Publish to client dashboard
- Share via external link, QR code, or email
- Per-field client toggles: View Supplier / View Brand / View Pricing / View Details / Can Approve
- Product name, image, code always visible regardless of toggles
- Every export carries last updated date/time as footer

**Order Tracking**
- Per order: order number, supplier, tracking link, shipment notes, procurement dates
- Status: Ordered / In Production / In Transit / Customs Hold / Delayed / Delivered / Installed
- Expected vs actual delivery date — delta flagged if late
- Payment tracking: client deposit, supplier deposit, client balance, supplier balance — all with dates
- Delay alert via WhatsApp if expected delivery passes without status update

**Project Finance (per project)**
- Contract value (owner/manager only)
- GST invoice creation: auto-numbered, studio + client details pre-filled
- Line items: description, HSN code, amount, GST rate (0/5/12/18/28%), CGST+SGST or IGST auto-calculated based on state codes
- Invoice status: Draft / Sent / Partially Paid / Paid / Overdue
- Send via email + WhatsApp simultaneously
- Payment recording: date, amount, bank reference, partial payments
- Auto-reminders: T-3 days, due date, +7 days overdue
- Running cost tracker: procurement + contractor payments + vendor payments vs estimate
- Invoice and payment history visible in client portal

**Meeting Log**
- Log: date, type, attendees
- Agenda + minutes (rich text)
- One-click: extract action items → create tasks with owner + due date
- Share notes via WhatsApp + email
- Full chronological history per project

**Moodboard / Presentation Builder**
- Phase 1: Canva API embed — create/save Canva boards within project context
- Phase 2: Proprietary drag-and-drop canvas (fabric.js)
- Pull product images from procurement library
- Templates: concept board, material palette, room-by-room, before/after
- Export as PDF or shareable link

---

### 5.2 CONTRACTOR MANAGEMENT
- Contractor profile: company name, type, contact, GSTIN, tax bracket, site supervisor details
- Contract/agreement upload + e-signature link
- Tendering: issue BOQ for pricing, receive and compare quotes
- Stage payment schedule with milestones and amounts
- Queries tracker with response deadlines
- WhatsApp automation: notify when new drawing issued, RFI responded, payment released

**RFI (Request for Information) Tracker**
- Raised by contractor (via contractor view) or designer internally
- Per RFI: ref number, date, raised by, title, description, linked drawing, space tag
- Assigned to designer with 48-hour response deadline (configurable)
- Status: Open → Under Review → Responded → Closed
- Escalation: if unanswered past deadline → auto-alert to project lead + principal via WhatsApp
- Full RFI log exportable per project as PDF

**Snag List (Punch List)**
- Item log: photo (required), location, description of defect
- Assigned to: Contractor / Vendor / Designer — with due date
- Status: Open / In Progress / Resolved / Client Signed Off
- Resolution requires photo evidence + comment
- Client sign-off via client portal (one tap)
- Full snag list exportable at project close

---

### 5.3 CLIENT MANAGEMENT
- Client profile: full name, company, phones, email, address, WhatsApp, preferred comms, available hours
- Associated projects (client linked to multiple projects)
- Contract + scope documents
- Reference files from client
- Approval tracking centre: all pending approvals across procurement/drawings/milestones
- Invoice centre: all invoices, payments, outstanding amounts
- Communication log: all WhatsApp messages sent via system

---

### 5.4 VENDOR MANAGEMENT
- Vendor profile: name, type, contact, GSTIN, bank details, showroom address
- Preferred vendor list per category
- Vendor rating per category after each project
- Lead time tracking: default vs actual
- Quote request template → vendor responds via shareable form (no login)
- PO creation: GST-compliant, send via WhatsApp or email
- Return/replacement request flow
- Payment tracking linked to project + studio finance

---

### 5.5 SITE MANAGEMENT
- Site photos/videos tagged by date, space, phase (before/during/after)
- Photo timeline view — before/during/after
- Daily site update form (contractor-facing, mobile-first): camera-first photo → space tag → status note → submit (3–4 taps)
- Designer controls which updates are client-visible
- WhatsApp notification when new update posted
- Site visit planning: schedule with attendees, agenda, linked tasks
- (Phase 3) Offline mode: queue locally, sync on reconnect

---

### 5.6 STUDIO MANAGEMENT
- Studio profile: name, logo, GSTIN, address, contact, bank details
- Role-based permissions: Owner / Senior Designer / Designer / Intern / Client (external) / Contractor (external)
- Permission logic:
  - Client: cannot see internal cost margins
  - Contractor: cannot see payroll or client financials
  - Intern: cannot see studio P&L or contract values
  - Owner: full access to all modules and financial settings
- User invite via email → invited user sets password, assigned role by owner
- Notification preferences per user: each user selects events + channel (WhatsApp/email/in-app)
- Employee profiles: full name, photo, contact, DOB, address, employment start, role, bank details
- Employment documents: agreement, offer letter, onboarding checklist
- Daily work hour tracking → payroll calculation
- Freelancer wage rates tracked separately
- Expense claims: submit with receipt, category, project, amount → owner approves → included in payroll
- Leave tracking: submit via WhatsApp or in-app → owner approves → balance tracked
- Studio product library: searchable by category, finish, supplier, price range

---

### 5.7 PORTFOLIO MANAGEMENT
- All active and archived projects in card format
- Cross-project Gantt: all project phases across studio
- Resource allocation map: designer → project → capacity % — flags over-capacity in red
- Portfolio export: select completed projects → auto-generate PDF with studio cover, project images, brief, team, scope, outcomes

---

### 5.8 FINANCIAL MANAGEMENT (Studio Level)
- Revenue dashboard: total revenue by project and by month
- Outstanding payments across all projects
- Studio expense tracker: rent, software, salaries, marketing, other
- Profit per project: revenue − procurement − contractor − designer time = margin
- Studio P&L: revenue, costs, gross margin, net margin — monthly and annual
- GST filing summary: output tax collected vs input tax paid — quarterly
- Export to CA-friendly CSV/Excel
- Alerts: payment received, payment overdue, payment due in 3 days

---

### 5.9 TIME TRACKING
- Hours per designer per project — daily or weekly entry
- Billable vs non-billable toggle
- Time logged vs time budgeted per phase — delta shown
- Time cost = hourly_rate × hours → feeds project profitability
- Weekly timesheet summary per team member — reminder if not submitted by Friday

---

### 5.10 SPECIFICATION BUILDER
- Material/finish spec per space and surface — distinct from procurement schedule
- Per item: space, surface (floor/wall/ceiling/joinery/other), material name, finish, supplier, notes, dimensions, drawing reference
- Link to procurement item
- Revision tracking: old value, new value, changed by, changed at, reason
- Export as formatted spec sheet PDF with studio branding

---

### 5.11 PROCESS MANAGEMENT (SOPs)
- Studio-defined process templates per project type
- Each template: phases, task sequence, names, default assignee role, default due date offset from phase start
- Task dependency rules within templates
- Upload and publish company SOPs as documents
- New project creation: select template → tasks + phases auto-populate → team adjusts dates/owners

---

### 5.12 STAKEHOLDER MANAGEMENT
- All parties: designers, contractors, sub-contractors, visualisers, consultants (structural, MEP, PMC)
- Per stakeholder: profile, scope assigned, contract, communication log
- Standardised contract templates per stakeholder type
- Approval/sign-off tracking
- Finance link: payment schedule per stakeholder

---

### 5.13 MARKETING MANAGEMENT (Phase 3)
- Social media post scheduler: Instagram, LinkedIn
- Instagram grid planner: visual preview with drag-to-reorder
- Blog post templates tied to completed projects
- SEO guidance per post
- Export to CMS via webhook (WordPress, Squarespace)

---

## CORE USER FLOWS

### Flow 1 — New Project Setup
1. Click '+ New Project'
2. Select project type + process template → tasks auto-populate
3. Fill project info: name, address, cover image, currency, GST bracket
4. Define scope of work + deliverables
5. Set phases + timeline
6. Assign team members + roles
7. Link client → triggers welcome WhatsApp with portal link
8. Review + create → project created, tasks populated from template

### Flow 2 — Procurement Schedule & Client Approval
1. Open Procurement tab in project
2. Add item via URL / manual / product library
3. Edit product image (crop + background removal)
4. Assign to room or schedule category
5. Share schedule with client → unique link + QR
6. Client receives WhatsApp with link
7. Client approves / revises / declines (comment required if revising)
8. Designer notified via in-app + WhatsApp
9. Approved items pull into finance running cost tracker
10. Export approved schedule as branded GST PDF

### Flow 3 — Contractor Site Update & RFI
1. Contractor receives unique link via WhatsApp (no login)
2. Opens contractor mobile view
3. Submits daily update: photo → space tag → note → submit (4 taps)
4. Designer + client notified via WhatsApp
5. Contractor raises RFI → linked to drawing/space → 48h deadline set
6. Designer responds → contractor notified → status → Responded
7. If no response in 48h → auto-escalation to project lead + principal
8. RFI closed → full log retained + exportable

### Flow 4 — Invoice Creation & Payment Tracking
1. Click 'Create Invoice' in project
2. Auto-populate: studio GSTIN, client details, project name, invoice number
3. Add line items: description, HSN code, amount, GST rate
4. CGST+SGST or IGST auto-calculated based on studio vs client state codes
5. Preview + send via email + WhatsApp simultaneously
6. Status tracks: Draft → Sent → Partially Paid → Paid → Overdue
7. Auto-reminders: T-3 days, due date, +7 days overdue
8. Payment recorded → studio P&L updated

---

## DATA MODEL

### 7.1 Core Entities

**studios** — `id, name, logo_url, gstin, address_line1-3, postcode, state_code, contact_phone, contact_email, bank_details (jsonb), currency (default INR), gst_brackets (jsonb), plan_tier (enum: starter/pro/scale), whatsapp_number, created_at`
> Every other table has studio_id as FK. plan_tier controls feature flags. state_code determines CGST+SGST vs IGST on invoices.

**users** — `id (references auth.users), studio_id, name, email, phone, whatsapp_number, dob, address, emergency_contact (jsonb), role (enum: owner/senior_designer/designer/intern), permissions (jsonb override), hourly_rate, employment_type, employment_start_date, bank_details (jsonb), profile_photo_url, is_active`
> permissions jsonb allows per-user overrides. is_active=false for terminated staff (data retained, login disabled).

**projects** — `id, studio_id, client_id, name, type (enum+custom), status (enum: active/on_hold/completed/archived/custom), address_line1-3, postcode, cover_image_url, currency, gst_bracket, scope_description, scope_items (jsonb), phases (jsonb array: [{name, start_date, end_date, status}]), template_id, pinterest_url, created_at, updated_at`

**project_members** — `id, project_id, user_id, project_role (text), added_at`
> Join table. A designer can be 'project lead' on one project and 'supporting designer' on another.

### 7.2 Task Entities

**tasks** — `id, studio_id, project_id, parent_task_id (nullable, self-ref for subtasks), title, description, status (enum: todo/in_progress/review/done), priority (enum: low/medium/high/urgent), phase_tag, room_tag, start_date, due_date, duration_days (computed), progress_percent (0-100), is_recurring, recurrence_rule (jsonb), created_by_id, created_at, updated_at`
> progress_percent: manual OR auto = (completed subtasks / total subtasks × 100)

**task_assignees** — `id, task_id, user_id, assigned_at, assigned_by_id`

**task_comments** — `id, task_id, studio_id, author_id, author_type (enum: internal/client), body, mentions (uuid array), is_client_visible, created_at`

**task_custom_fields** — `id, studio_id, project_id (nullable), field_name, field_type (enum: text/number/date/dropdown/checkbox), field_options (jsonb), is_default`

### 7.3 Document & Procurement Entities

**documents** — `id, studio_id, project_id, name, category (enum: drawings/specifications/site_photos/contracts/reports/client_shared/contractor_shared), file_url, file_type, version_number (int), version_status (enum: latest_issued/superseded/archived), access_level (enum: internal/client/contractor/public), uploaded_by_id, uploaded_at, previous_version_id (self-ref)`
> When new version marked latest_issued → auto-set previous to superseded. Contractor access log in document_access_logs table.

**procurement_schedules** — `id, studio_id, project_id, name, type (enum: room_based/schedule_based), status, owner_id, shared_with (jsonb), is_client_published (bool), last_updated_at, is_archived`

**procurement_items** — `id, studio_id, project_id, schedule_id, room_or_category, name, description, product_code, brand, supplier_id (FK nullable), dimensions_length/height/depth/unit, finish, quantity, material, unit_cost, total_cost (computed: unit_cost × quantity), image_url, quotation_attachment_url, in_stock, is_flagged, is_archived`

**procurement_item_status** — `id, item_id (FK unique), curation_status, client_approval_status, procurement_status, payment_status, client_comment, updated_at`
> One-to-one with procurement_items. Four independent tracks.

### 7.4 Client, Finance & Communication Entities

**clients** — `id, studio_id, name, company (nullable), email, phone_primary, phone_secondary, address_line1-3, postcode, state_code, whatsapp_number, preferred_comms (enum), available_hours, social_media (jsonb), portal_token (uuid), portal_token_expires_at`
> portal_token = no-login access key. state_code vs studio.state_code determines GST split on invoices.

**invoices** — `id, studio_id, project_id, client_id, invoice_number (auto-incremented per studio, format: PF-2025-0042), line_items (jsonb array: [{description, hsn_code, amount, gst_rate, cgst, sgst, igst}]), subtotal, gst_amount, total, status (enum: draft/sent/partial/paid/overdue), issue_date, due_date, sent_at, reminder_sent_at (timestamp array)`
> GST split: studio.state_code == client.state_code → CGST+SGST; else → IGST

**invoice_payments** — `id, invoice_id, studio_id, amount, payment_date, bank_reference, notes, recorded_by_id, created_at`
> Multiple payments per invoice for partial payment support. Sum vs invoice.total determines status.

**whatsapp_messages** — `id, studio_id, recipient_type (enum: client/contractor/vendor/user), recipient_id, template_id, variables (jsonb), status (enum: queued/sent/delivered/failed), sent_at, project_id (nullable)`

### 7.5 Contractor, Site & Accountability Entities

**contractors** — `id, studio_id, company_name, company_type, contact_name, phone, email, whatsapp_number, address, gstin, tax_bracket, site_supervisor_name, site_supervisor_phone, contractor_token (uuid), contractor_token_expires_at`

**rfis** — `id, studio_id, project_id, contractor_id, ref_number (format: RFI-P042-003), raised_by_type (enum: contractor/designer), raised_by_id, title, description, linked_document_id (nullable), space_tag, status (enum: open/under_review/responded/closed), response_deadline, response_text, responded_by_id, responded_at, escalated_at`
> Escalation: scheduled job checks response_deadline hourly → if passed and still open → set escalated_at → fire WhatsApp to project lead + owner

**snag_items** — `id, studio_id, project_id, photo_url (required), location_description, plan_reference, description, assigned_to_type (enum: contractor/vendor/designer), assigned_to_id, due_date, status (enum: open/in_progress/resolved/client_signed_off), resolution_photo_url, resolution_note, client_signed_off_at, client_signed_off_by`

**site_updates** — `id, studio_id, project_id, submitted_by_type (enum: contractor/designer), submitted_by_id, photos (text array of URLs), space_tag, phase_tag (enum: before/during/after), status_note, submitted_at, is_client_visible (default false), offline_queued (default false)`

### 7.6 Vendor, Time & Studio Operation Entities

**vendors** — `id, studio_id, name, type (enum+custom), contact_name, phone, email, whatsapp_number, showroom_address, gstin, bank_details (jsonb), preferred_categories (text array), default_lead_time_days, rating_by_category (jsonb: {furniture: 4.2, tiles: 3.8})`

**time_entries** — `id, studio_id, project_id, user_id, hours (decimal), entry_date, phase_tag, is_billable (bool), notes, hourly_rate_snapshot (decimal)`
> hourly_rate_snapshot copied at time of entry — never changes. Ensures historical profitability accuracy.

**spec_items** — `id, studio_id, project_id, space, surface (enum: floor/wall/ceiling/joinery/other), material_name, finish_type, supplier_id, location_notes, dimensions, drawing_reference, linked_procurement_id (nullable), revisions (jsonb array: [{changed_by_id, changed_at, field_name, old_value, new_value, reason}])`

**expense_claims** — `id, studio_id, user_id, project_id (nullable), category, amount, receipt_photo_url, notes, status (enum: pending/approved/rejected), approved_by_id, approved_at, included_in_payroll_run_id`

**process_templates** — `id, studio_id, name, project_type, phases (jsonb), tasks (jsonb array of task definitions with role, offset_days, dependencies)`
> On project creation from template: iterate tasks jsonb → create real task records with dates = project start + offset_days

---

## TECHNOLOGY STACK

| Layer | Recommended | Notes |
|---|---|---|
| Frontend | React + TypeScript + Next.js 14 (App Router) | SSR, file-based routing |
| UI Components | shadcn/ui + Tailwind CSS | Unstyled, fully customisable |
| Database + Backend | Supabase (Postgres + Auth + Storage) | RLS handles multi-tenancy |
| Authentication | Supabase Auth | Email + Google OAuth + magic link |
| File Storage | Supabase Storage (S3-compatible) | Path: /{studio_id}/{project_id}/{category}/{version}/{filename} |
| WhatsApp | Wati.io or 360dialog | India-popular; start Facebook Business Manager verification Day 1 |
| Automation | n8n (self-hosted) or Make.com | For WhatsApp triggers and scheduled jobs |
| PDF Generation | Puppeteer (server-side) | For all branded exports — invoices, procurement PDFs, spec sheets |
| Image Editing | Pintura (in-browser) | Crop + background removal for procurement product images |
| Email | Resend.com | Transactional emails alongside WhatsApp |
| Gantt / Timeline | DHTMLX Gantt | Free open source, supports dependencies + drag-to-reschedule |
| Moodboard (Phase 1) | Canva API embed | Fastest path to presentation builder |
| Moodboard (Phase 2) | fabric.js | After Canva validates UX requirements |
| Payments / Billing | Razorpay (INR) | INR subscription billing |
| Hosting | Vercel (frontend) + Supabase (backend) | Both have India-region edge nodes |
| Mobile App (Phase 3) | React Native + Expo | Code sharing with React web frontend |

---

## PHASED BUILD ROADMAP

### Phase 0 — Weeks 1–8 (The Indispensable Core)
Project Setup · Task Management (Kanban + Gantt) · Document Centre (version control) · Client Portal (branded, no-login) · Procurement & Approvals (with client approval flow) · Project Finance (GST invoicing + payment tracking) · Site Tracking (basic) · Studio Core Setup (roles, permissions, WhatsApp, notifications)

### Phase 1 — Months 3–5 (The Accountability Layer)
Contractor Management · RFI Tracker · Snag List · Client Management (full) · Order Tracking · Specification Builder · Meeting Log · Time Tracking + Profitability · Canva API Moodboard

### Phase 2 — Months 5–9 (The Studio Operations Layer)
Studio Management (HR + payroll + leave + expenses) · Product Library · Studio-Level Finance (P&L + GST summary) · Process Management (SOP templates) · Vendor Management (full) · Portfolio Management · Stakeholder Management · Proprietary Moodboard (fabric.js)

### Phase 3 — Month 9+ (The Intelligence & Growth Layer)
Marketing Management · Automation & Intelligence (health scores, delay prediction) · Advanced Reporting · Offline Mobile App (iOS + Android)

---

## PHASE 0 SPRINT PLAN

| Sprint | Weeks | Deliverables |
|---|---|---|
| 1 | 1–2 | Auth, multi-tenant studio setup, role-based permissions, navigation shell, design system |
| 2 | 2–3 | Project creation wizard (5-step), project detail page, phase management, team assignment, template selection |
| 3 | 3–4 | Task management: Kanban, list view, Gantt, subtasks, dependencies, comments, attachments, overdue alerts |
| 4 | 4–5 | Document centre: upload, versioning, latest-issued flag, access control, share link + QR |
| 5 | 5–6 | Procurement: add items, image editor, room/schedule toggle, client approval flow, PDF export |
| 6 | 6–7 | Project finance: GST invoice creation, CGST/SGST/IGST calc, WhatsApp+email send, payment recording, reminders |
| 7 | 7–8 | Client portal (no-login), site photo tracking, daily site update form, WhatsApp automation, notification preferences, full QA |

---

## WHATSAPP INTEGRATION SPECIFICATION

**Provider:** Wati.io (recommended) or 360dialog
**Important:** Begin Facebook Business Manager verification on Day 1 — takes 2–4 weeks
**Rule:** WhatsApp is outbound notification + link only. Users never type commands into WhatsApp.

### Required Message Templates

| Template ID | Trigger | Recipient |
|---|---|---|
| project_welcome_client | New project created + client linked | Client |
| procurement_approval_request | Schedule shared with client | Client |
| procurement_item_actioned | Client completes approval action | Designer |
| invoice_sent | Invoice sent to client | Client |
| invoice_reminder_due | 3 days before invoice due | Client |
| invoice_overdue | 7 + 14 days after due date (if unpaid) | Client |
| weekly_project_update | Every Monday 9AM auto-generated | Client |
| site_update_posted | Contractor/designer posts site update | Designer + Client (if client-visible) |
| new_drawing_issued | Document marked latest_issued + contractor-visible | Contractor |
| rfi_received | Contractor raises new RFI | Designer |
| rfi_response_sent | Designer responds to RFI | Contractor |
| rfi_escalation | RFI response deadline passed | Project lead + Studio principal |
| task_overdue | Task past due date, not marked done | Task owner |
| stage_payment_released | Designer marks stage payment released | Contractor |
| leave_request_received | Employee submits leave request | Studio owner |

---

## PRICING & SUBSCRIPTION TIERS

| | Studio Starter | Studio Pro | Studio Scale |
|---|---|---|---|
| Price | ₹4,999/month | ₹9,999/month | ₹18,999/month |
| Active Projects | Up to 5 | Up to 15 | Unlimited |
| Team Members | Up to 3 | Up to 15 | Unlimited |
| File Storage | 10 GB | 50 GB | 200 GB |
| WhatsApp messages/month | 500 | 2,000 | Unlimited |
| RFI tracker + Snag list | ✗ | ✓ | ✓ |
| Time tracking + profitability | ✗ | ✓ | ✓ |
| Specification builder | ✗ | ✓ | ✓ |
| Studio management (HR + payroll) | ✗ | ✗ | ✓ |
| Advanced reporting + CA export | ✗ | ✗ | ✓ |

---

## CRITICAL TECHNICAL DECISIONS (make before writing any code)

1. **Multi-tenancy:** Supabase RLS with studio_id on every table. Confirm RLS policy pattern before creating any table.
2. **WhatsApp provider:** Choose Wati.io vs 360dialog in Week 1. API shape affects every automation.
3. **PDF generation:** Server-side Puppeteer (not react-pdf). Confirm before any export feature is built.
4. **File storage path:** `/{studio_id}/{project_id}/{category}/{version_or_date}/{filename}` — define before any upload feature.
5. **Token strategy:** Client portal, contractor view, vendor forms use UUID tokens. 90-day expiry, regeneratable, revocable.
6. **GST calculation:** studio.state_code vs client.state_code → same state = CGST+SGST; different state = IGST.
7. **GSTIN validation:** 15-character checksum validation on all GSTIN input fields from the start.
8. **Invoice numbering:** Format `[STUDIO_PREFIX]-[YEAR]-[SEQ]` e.g. PF-2025-0042.

---

## DESIGN PRINCIPLES

- **Mobile-first** for all external views (client portal, contractor view, vendor forms) — test on mid-range Android
- **Desktop-optimised** for studio internal app — procurement table and task board use full screen real estate
- **WhatsApp = notification + link channel only** — never a data entry channel
- **Every PDF export** must carry studio branding: logo, brand colours, GSTIN
- **No external user (vendor/contractor) ever creates an account** — all interactions are form-link based
- **Notification fatigue is an adoption killer** — default to fewer notifications; users opt in to more

---

## PRE-LAUNCH CHECKLIST

- [ ] All Phase 0 flows tested end-to-end with a real pilot studio
- [ ] WhatsApp Business number verified, all Phase 0 templates approved by Meta
- [ ] GST invoice format reviewed by a CA
- [ ] GSTIN checksum validation implemented on all input fields
- [ ] Supabase RLS policies audited — no studio can read/write another studio's data
- [ ] PDF exports tested: Chrome desktop, Safari desktop, Chrome Android, Safari iOS
- [ ] Client portal tested end-to-end on Android Chrome
- [ ] Razorpay integration tested with real INR test transactions
- [ ] Load test: 50 concurrent studios on Supabase

---

*Last updated: May 2025 | Version 3.0 | Supersedes V1.0 and V2.0*
