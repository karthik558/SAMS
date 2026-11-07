<div align="center">
  <img src="public/sams_logo.png" alt="SAMS" />
</div>
<div align="center">
  <h1>SAMS &mdash; Smart Asset Management System</h1>
  <p>Centralized asset lifecycle management, QR-enabled tracking, and collaborative operations for modern teams.</p>
  <p>
    <a href="https://samsproject.in/demo/login" target="_blank" rel="noopener">
      <img src="https://img.shields.io/badge/Live%20Demo-Open-2ea44f?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
    </a>
    &nbsp;
    <a href="#overview">
      <img src="https://img.shields.io/badge/Open%20Source-100%25-2962FF?style=for-the-badge&logo=github&logoColor=white" alt="Open Source" />
    </a>
  </p>
</div>

---

## Overview

SAMS streamlines how enterprises catalogue, monitor, audit, and label fixed assets across locations. Assets, properties, users, tickets, and audit workflows live in a cohesive UI backed by modern tooling (React, TypeScript, Supabase).

### Why SAMS

- Replace spreadsheets with a single source of truth for asset history and ownership.
- Enable facilities, finance, and audit teams to collaborate with guardrails.
- Deliver QR-ready labels and mobile friendly workflows for field operations.

## Table of Contents

- [Product Highlights](#product-highlights)
- [Platform Modules](#platform-modules)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
- [Everyday Development](#everyday-development)
- [Quality & Observability](#quality--observability)
- [Pending Initiatives](#pending-initiatives)
- [Deployment Notes](#deployment-notes)
- [Live Demo](#live-demo)
- [Support](#support)
- [Browser & Device Support](#browser--device-support)
- [License & Conduct](#license--conduct)

## Product Highlights

### Asset Lifecycle & Registry
- Rich asset metadata (status, ownership, procurement, lifecycle dates).
- Quantity normalization into unit level records for accurate tracking.
- Natural asset ID ordering keeps sibling items grouped together.

### Properties & Access Control
- Property directory with status flagging and role-based visibility.
- Department and property access configurations scoped per user.
- Approval indicators surface pending admin/manager actions in context.

### QR Labelling & Printing Workflows
- One-off and bulk QR generation with PNG, ZIP, and PDF export flows.
- Label presets plus custom sizing for print hardware alignment.
- Print history and reprint safeguards for audit evidence.

### Tickets, Notifications & Collaboration
- Role-aware maintenance tickets with Kanban and list views.
- SLA and priority badges, comment locking on closed tickets.
- Notification bell with deep links that open scoped context instantly.

### Insights & Reliability
- Dashboard metrics, reports, and downloadable exports for audits.
- PWA-ready install experience with offline asset list caching.

## Platform Modules

| Module | What It Covers |
| --- | --- |
| **Dashboard** | Metrics, activity feed, quick actions, audit readiness snapshot |
| **Assets** | Advanced table & grid views, QR generation, bulk actions, exports |
| **Properties** | Location registry, status controls, per-role visibility |
| **QR Codes** | History, preview, downloads, print orchestration |
| **Tickets** | Maintenance lifecycle, SLA tracking, Kanban board |
| **Announcements** | Release notes, maintenance bulletins, category badges |
| **Reports** | Operational insights, audit exports, scoped access |
| **Settings & Users** | Role management, permissions, department/property access |

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI, Radix Primitives
- **State & Data:** React Query, context providers, local caching fallbacks
- **Backend Services:** Supabase (Auth, Database, Storage) with demo/local mock layers
- **Utilities:** date-fns, ExcelJS, ZXing, JSZip, Zod schema validation
- **Tooling:** ESLint, TypeScript, Prettier (via editor integration), npm scripts

## Getting Started

### Prerequisites

- Node.js 18+ and npm (the repository uses `package-lock.json`).
- A Supabase project for real accounts and data. The isolated demo is available at `/demo/login`.

### Installation

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Visit `http://localhost:8000`. Populate `.env.local` with your project's values; never commit it or paste its secrets into chat.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the browser configuration. Use the project's legacy signed anon key with the current Edge Function gateway configuration. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, and `RESEND_API_KEY` are server/operator secrets and must never have `VITE_` prefixes.

### Database setup

[`schema.sql`](schema.sql) is the single application database definition. Run the whole file once in the SQL editor of a **fresh Supabase project**, as `postgres`. It creates all 31 SAMS tables, the view, functions, constraints, indexes, RLS policies/grants, the custom Auth trigger, and realtime membership. It includes no production data or user accounts.

The file requires Supabase's managed Auth schema and API roles; it does not install the Supabase platform on a plain PostgreSQL server. It rejects an existing application schema before changing anything. **Do not run it against the existing SAMS production database as an upgrade.**

Create your own verified account in Supabase Auth, then provision its initial administrator profile using the exact Auth ID, as described in [account setup](docs/user-account-security.md). Deploy the required Edge Functions and Auth configuration from `supabase/`; SQL cannot configure SMTP or deploy HTTP functions.

### Everyday development

- `npm run dev` — start the development server.
- `npm run build` — create the production bundle.
- `npm run preview` — serve the production build locally.
- `npm run lint` — run ESLint.
- `npm test` — run the focused API security regression checks without using a live database or sending email.
- `npx tsc --noEmit -p tsconfig.app.json` — check application types.

We recommend enabling the workspace ESLint and Tailwind extensions in VS Code for instant feedback.

## Quality & Observability

- **Testing:** `tests/security` keeps only the focused API and account-backend regression checks. One-time migration fixtures and operator scripts have been removed. Backend checks can be run with `deno test --no-lock --allow-env tests/security/account-security.test.ts`; requests are mocked.
- **Accessibility:** UI patterns follow Shadcn/Radix best practices (keyboard navigable, ARIA annotations).
- **Logging:** application events are surfaced through toast notifications and audit trails; Supabase provides server-side logs when enabled.

## Pending Initiatives

These items are actively tracked for upcoming releases:

- Advanced analytics dashboard with multi-property drill downs.
- Offline-first write queue for ticket updates made in the field.
- Automated label layout designer with saved presets per printer model.
- End-to-end testing harness (Playwright) integrated into CI.
- Role-based data retention policies and export audit trails.

## Deployment Notes

- Vercel is the reference deployment target (see `vercel.json`).
- Configure environment variables through the Vercel dashboard or your hosting provider of choice.
- For self-hosting, ensure HTTPS is enforced; QR download endpoints expect secure origins for camera access.

## Live Demo

<div align="left">
  <a href="https://samsproject.in/demo/login" target="_blank" rel="noopener">
    <img src="https://img.shields.io/badge/LIVE%20DEMO-OPEN-orange?style=for-the-badge" alt="Live Demo" />
  </a>
  <br />
  <strong>Demo credentials</strong>: Username <code>demo@demo.com</code> &nbsp;&bull;&nbsp; Password <code>demo@123</code>
</div>

## Support

Need help, feature guidance, or a tailored walkthrough?
- Email: <a href="mailto:karthik@samsproject.in">karthik@samsproject.in</a>
- Issues: open a GitHub ticket to report bugs or request enhancements.

## Browser & Device Support

- Fully responsive layouts for desktop, tablet, and mobile breakpoints.
- Optimized for the latest versions of Chrome, Edge, Firefox, and Safari.
- Installable PWA for quick launch on mobile and desktop.

## License & Conduct

This project is open source under the MIT License. Contributions adhere to the community Code of Conduct; please review both before submitting pull requests.

---

© SAMS Contributors. Built for resilient asset operations.
