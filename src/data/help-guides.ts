import type { LucideIcon } from "lucide-react";
import {
  Package,
  BarChart3,
  ClipboardCheck,
  QrCode,
  LifeBuoy,
  Ticket,
} from "lucide-react";

export type HelpGuideStep = {
  title: string;
  description: string;
  /**
   * Route to navigate to when this step starts.
   */
  route?: string;
  /**
   * Optional hint callout displayed beneath the step description.
   */
  tip?: string;
};

export type HelpGuide = {
  id: string;
  title: string;
  summary: string;
  audience: string;
  icon: LucideIcon;
  steps: HelpGuideStep[];
};

export const helpGuides: HelpGuide[] = [
  {
    id: "add-asset",
    title: "Add a new asset",
    summary: "Create an asset entry, capture key metadata, and confirm it appears in the catalogue.",
    audience: "Team members",
    icon: Package,
    steps: [
      {
        title: "Open the Assets workspace",
        description: "Navigate to the Assets page to access the catalogue and creation tools.",
        route: "/assets",
      },
      {
        title: "Launch the Add Asset form",
        description: "Click the Add Asset button in the header. A drawer or page section will open with the asset form.",
        tip: "If you do not see the button, confirm your role has edit access or request it from an administrator.",
      },
      {
        title: "Fill in the asset details",
        description:
          "Complete the required fields (Name, Type, Property, Department, Quantity). Add optional fields like purchase dates or serial numbers if you track them.",
      },
      {
        title: "Save and verify the record",
        description:
          "Submit the form. The asset appears at the top of the table using the next auto-generated ID. Use the search to make sure it is listed.",
      },
      {
        title: "Generate a QR code (optional)",
        description:
          "Select the new asset and use Generate & Download QR Sheet, or click the QR icon in the Actions column to produce a single QR label.",
        tip: "QR codes are helpful for audits and quick lookups in the field.",
      },
    ],
  },
  {
    id: "generate-report",
    title: "Generate a report",
    summary: "Choose the right template, scope the data, and export or email your report.",
    audience: "Managers & admins",
    icon: BarChart3,
    steps: [
      {
        title: "Open the Reports workspace",
        description: "Move to the Reports page to access available templates and recent exports.",
        route: "/reports",
      },
      {
        title: "Pick a report template",
        description:
          "Select the report that matches what you need (Asset Summary, Property-wise, Department-wise, Expiry Tracking, or Audit Review).",
        tip: "Use the description under each template to confirm the output.",
      },
      {
        title: "Configure filters",
        description:
          "Adjust property, department, asset type, and date ranges so the data set reflects your scope. Some templates unlock extra filters like audit session or department.",
      },
      {
        title: "Choose delivery format",
        description:
          "Select PDF, Excel, CSV, or JSON. Optionally enable Email report to administrators to notify stakeholders automatically.",
      },
      {
        title: "Generate and download",
        description:
          "Click Generate Custom Report. When complete, the file appears in Recent Reports where you can download it again or check its status.",
      },
    ],
  },
  {
    id: "review-approval",
    title: "Review an asset approval",
    summary: "Work through a pending approval, compare changes, and apply or reject the request.",
    audience: "Managers & admins",
    icon: ClipboardCheck,
    steps: [
      {
        title: "Go to the Approvals queue",
        description: "Open the Approvals page to see all requests that need attention.",
        route: "/approvals",
      },
      {
        title: "Filter to your workload",
        description:
          "Use the status or department filters to focus on requests assigned to you. Managers typically approve for their department, admins see escalations.",
      },
      {
        title: "Inspect the requested changes",
        description:
          "Select a request to view the differences between the current asset and the proposed update. Field-level comparison and comments appear in the detail panel.",
      },
      {
        title: "Decide and respond",
        description:
          "Approve & Apply to merge the changes, Reject to send it back with notes, or Forward to Admin for additional review. Add notes to document the action taken.",
      },
      {
        title: "Track resolution",
        description:
          "Approved items update the asset immediately and fall into the Approved tab. Rejected or forwarded requests log a timeline event for transparency.",
      },
    ],
  },
  {
    id: "perform-audit",
    title: "Complete an audit session",
    summary: "Work through assigned departments, scan assets, and produce a closure report.",
    audience: "Managers & auditors",
    icon: QrCode,
    steps: [
      {
        title: "Open the Audit workspace",
        description: "Navigate to Audit to view active sessions and your department assignments.",
        route: "/audit",
      },
      {
        title: "Review session scope",
        description:
          "Pick the current session or start a new one if you are an admin. Confirm the property, departments, and cadence are correct before proceeding.",
      },
      {
        title: "Verify assets",
        description:
          "Use the Verify tab to mark assets as Verified, Missing, or Damaged. Scan QR codes for quicker lookups and add notes for discrepancies.",
        tip: "If you cannot find an asset, log it as Missing and leave a comment so the record is traceable.",
      },
      {
        title: "Submit department results",
        description:
          "When finished, submit the audit for your department. The progress rings update and audit coordinators can see what remains.",
      },
      {
        title: "Export the audit report",
        description:
          "Use Generate Report to create a PDF summary for stakeholders or to archive the session outcome.",
      },
    ],
  },
  {
    id: "raise-ticket",
    title: "Raise a support ticket",
    summary: "Create a ticket for maintenance, access, or license requests and monitor responses.",
    audience: "All users",
    icon: Ticket,
    steps: [
      {
        title: "Open the Tickets workspace",
        description: "Go to Tickets to view your queue and existing conversations.",
        route: "/tickets",
      },
      {
        title: "Start a new ticket",
        description: "Click New Ticket. If you have a saved draft it will appear here as well.",
      },
      {
        title: "Describe the request",
        description:
          "Select the ticket type, provide a clear subject, and include asset IDs or screenshots so the support team can act quickly.",
      },
      {
        title: "Submit and monitor",
        description:
          "Submit the ticket. Status and replies update in the same list, and notifications alert you when the team responds.",
      },
    ],
  },
  {
    id: "command-palette",
    title: "Navigate with the command palette",
    summary: "Use keyboard shortcuts to reach pages, actions, and records without leaving the keyboard.",
    audience: "Power users",
    icon: LifeBuoy,
    steps: [
      {
        title: "Open the command palette",
        description: "Press ⌘K (macOS) or Ctrl+K (Windows/Linux) to launch the command palette from anywhere.",
      },
      {
        title: "Search for destinations",
        description:
          "Type the name of a page (e.g., “Assets”, “Reports”), a quick action like “Add Asset”, or a ticket/asset ID to jump directly.",
      },
      {
        title: "Execute the action",
        description: "Use the arrow keys or mouse to select the option and press Enter. The app navigates instantly with your current session data.",
      },
    ],
  },
];

export function getHelpGuide(id: string): HelpGuide | undefined {
  return helpGuides.find((guide) => guide.id === id);
}
