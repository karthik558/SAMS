<img src="https://raw.githubusercontent.com/FoORK-Lab/pass-gen-dependencies/refs/heads/main/sams_banner.jpg" alt="SAMS"/>
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
- **Tooling:** ESLint, TypeScript, Prettier (via editor integration), pnpm/npm scripts

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Supabase project (optional for local demo & auth features)

### Installation

```bash
# install dependencies
pnpm install

# start the development server
pnpm dev
```

Visit `http://localhost:5173` in your browser.

### Environment Configuration

Copy `.env.example` to `.env.local` and populate the following when integrating with Supabase:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_SERVICE_KEY=
VITE_SUPABASE_ANON_KEY=
```

When the environment variables are absent, SAMS gracefully falls back to seeded demo data, allowing evaluation without backend services.

## Everyday Development

- `pnpm dev` &mdash; run locally with hot module replacement.
- `pnpm lint` &mdash; enforce TypeScript and accessibility rules via ESLint.
- `pnpm build` &mdash; create a production bundle through Vite.
- `pnpm preview` &mdash; serve the production build locally.

We recommend enabling the workspace ESLint and Tailwind extensions in VS Code for instant feedback.

## Quality & Observability

- **Testing:** component level tests are being introduced alongside critical modules; snapshot and regression suites are planned for future milestones.
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
