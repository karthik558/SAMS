<img src="https://raw.githubusercontent.com/FoORK-Lab/pass-gen-dependencies/refs/heads/main/sams_banner.jpg" alt="SAMS"/>
<div align="center">
	<h1>SAMS (Smart Asset Management System)</h1>
	<p>Centralized asset lifecycle, tracking, and auditing for modern operations</p>
	<p>
		<a href="https://sams-ams.vercel.app/demo/login" target="_blank" rel="noopener">
			<img src="https://img.shields.io/badge/LIVE%20DEMO-OPEN-orange?style=for-the-badge" alt="Live Demo" />
		</a>
		&nbsp;
		<a href="#overview">
			<img src="https://img.shields.io/badge/100%25%20OPEN%20SOURCE-YES-brightgreen?style=for-the-badge" alt="100% Open Source" />
		</a>
	</p>
</div>

---

## Overview

SAMS streamlines the full lifecycle of physical assets across properties and departments. It helps teams register, track, audit, and label assets with efficient QR-based workflows, clear ownership, and strong accountability. This project is 100% open source.

## Table of Contents

- [Key Capabilities](#key-capabilities)
- [Modules](#modules)
- [Tickets](#tickets)
- [Announcements-newsletter](#announcements-newsletter)
- [Notifications--deep-links](#notifications--deep-links)
- [Benefits](#benefits)
- [Who It’s For](#who-its-for)
- [Security and Access](#security-and-access)
- [Printing and Labels](#printing-and-labels)
- [Reliability and Offline](#reliability-and-offline)
- [Supabase Setup — Newsletter](#supabase-setup--newsletter)
- [Live Demo](#live-demo)
- [Request a Demo](#request-a-demo)
- [Browser and Device Support](#browser-and-device-support)
- [Versioning and Releases](#versioning-and-releases)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Code of Conduct](#code-of-conduct)

## Key Capabilities

- Asset registry and lifecycle
	- Create and manage assets with rich attributes (type, location, status, dates, purchasing details)
	- Quantity normalization into unit-level records for precise tracking and labeling
	- Natural Asset ID sorting to keep related unit IDs adjacent

- Properties and locations
	- Property directory with status controls and visibility rules
	- Filters and access controls aligned to property permissions

- QR codes and labeling
	- Single and bulk QR generation with labeled images
	- Download as PNG, ZIP (PNGs), or PDF (via print flows)
	- Label printing support with common presets and custom sizes
	- Print history and status tracking for reprints and audits

- Views, filters, and productivity
	- Grid and list views, date-range filtering, and quick search
	- Column chooser with user preferences persisted across sessions
	- Mobile-friendly layouts and responsive interactions

- Ticketing and collaboration
	- Create, assign, and track maintenance tickets across properties
	- List and Kanban (board) views with drag-to-change status
	- Color-coded status and priority pills; SLA badge
	- Closed-only toggle; closed tickets lock replies by design
	- Deep-links from notifications open the exact ticket and auto-expand details

- Announcements and release notes
	- Sidebar “Announcement” card with quick preview and modal “Read more”
	- Full “Status & Updates” page with searchable timeline/cards
	- Predefined categories (Bug, API Down, Fixed, Resolved, Maintenance, Update) with badges
	- Admins can create, edit, delete posts (Supabase-backed with local fallback)

- Governance and controls
	- Role-based access with gated actions and views
	- Approval workflow indicators for controlled changes
	- Activity logging and notifications for key events

- Reporting and insights
	- High-level dashboard metrics and charts
	- Property and asset type summaries

- Installable and reliable
	- Installable application with offline support
	- Local caching of asset lists by property to keep work moving without connectivity

## Modules

- Dashboard: metrics, trends, quick actions, and activity
- Assets: searchable table, QR generation, bulk actions, and exports
- Properties: directory, health, and status controls
- QR Codes: history, preview, downloads, print, and reprint
- Tickets: create/assign, list and board, status/SLA, comments
- Announcements: sidebar card + full page with categories and search
- Reports: configurable outputs for operations and audit
- Settings and Users: administrative controls and permissions

## Tickets

Role-aware ticket management for maintenance and requests.

- Create tickets with property, assignee, priority, and target role
- Board and list views with drag-and-drop status updates
- Color-coded status and priority; SLA badge on deadlines
- Closed-only filter; closed tickets cannot receive new comments
- Notification deep-links expand the target ticket when opened

## Announcements (Newsletter)

Keep all users informed about changes, maintenance, and releases.

- Sidebar Announcement card shows the latest post with a compact preview
- “Read more” opens a modal; “View all” goes to the full page
- Full page supports search, category badges, and admin CRUD
- Predefined categories with colors: Bug (red), API Down (red), Fixed (green), Resolved (green), Maintenance (amber), Update (blue)
- Supabase-backed with local fallback and demo seeding

## Notifications & Deep Links

The bell menu lists recent notifications. Clicking navigates directly to the relevant view:

- Tickets: opens `/tickets?id=TCK-…` and auto-expands the ticket
- QR: opens the asset details if an asset id is present, otherwise QR Codes
- Reports/System: opens the corresponding page

## Benefits

- Faster asset onboarding and updates
- Greater audit readiness with consistent records and print history
- Reduced duplication by unit-level normalization and natural ID sorting
- Clear governance through role-based actions and approvals

## Who It’s For

- Administrators: governance, user access, global settings
- Managers: asset oversight, property visibility, reporting
- Operators: day-to-day asset creation, QR generation, labeling
- Auditors: read-only access to reports, histories, and evidence

## Security and Access

- Role-aware navigation and actions
- Sensitive elements hidden for non-privileged users
- Visibility aligned with property access rules

## Printing and Labels

- One-click print dialog for A4 sheets
- Label print flows with exact page sizing
- Presets for common label formats and custom width/height options

## Reliability and Offline

- Installable on desktop and mobile
- Asset list caching by property for offline reference
- Auto-update mechanism to keep the application current

## Live Demo

<div align="center">
	<a href="https://sams-ams.vercel.app/demo/login" target="_blank" rel="noopener">
		<img src="https://img.shields.io/badge/LIVE%20DEMO-OPEN-orange?style=for-the-badge" alt="Live Demo" />
	</a>
	<br />
	<b>Experience SAMS instantly in your browser.</b>
	<br />
	<b>Demo credentials</b>: Username <code>demo@demo.com</code> • Password <code>demo@123</code>
	<br />
	Want a demo for your company? Contact <a href="mailto:dev@karthiklal.in">dev@karthiklal.in</a>.
</div>

## Request a Demo

Want a demo for your company? Contact dev@karthiklal.in.

## Browser and Device Support

- Current desktop browsers and mobile webviews
- Responsive layouts for phones, tablets, and desktops

## Versioning and Releases

- Semantic versioning for clarity and predictability
- Release notes summarize notable changes and improvements
## FAQ

- Can I import existing assets? Yes; use the bulk import template and upload.
- How does offline mode work? Asset lists per property are cached for reference when disconnected.
- How do roles work? Navigation and actions are gated by assigned role.
- How do I print labels? Use the QR Codes page or bulk flows; choose label presets or custom sizes.
- Can I export data for audits? Reports support export; QR history retains print status.

## Troubleshooting

- I don’t see certain cards on the dashboard: access is role-based.
- QR image won’t download: try the print-to-PDF option or clear browser cache.
- No assets visible: check filters, property access, and column visibility.


## License

This project is open source under a permissive license.

## Code of Conduct

All contributors are expected to uphold a professional and respectful environment.