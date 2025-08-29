import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusChipProps = {
  status?: string | null;
  className?: string;
  size?: "sm" | "md";
  titleCase?: boolean;
};

// Map many common statuses to themed color classes (light/dark friendly via tokens)
const colorFor = (raw?: string | null) => {
  const s = (raw || "").toString().toLowerCase();
  // Approvals
  if (s === "approved" || s === "success" || s === "completed") return "bg-success/15 text-success border-success/20";
  if (s === "rejected" || s === "failed" || s === "error") return "bg-destructive/15 text-destructive border-destructive/20";
  if (s.startsWith("pending")) return "bg-warning/15 text-warning border-warning/20";
  // Users / Properties
  if (s === "active" || s === "enabled") return "bg-success/15 text-success border-success/20";
  if (s === "inactive" || s === "disabled") return "bg-muted text-foreground/70 border-border";
  // Assets
  if (s === "expiring soon" || s === "warning") return "bg-warning/15 text-warning border-warning/20";
  if (s === "expired") return "bg-destructive/15 text-destructive border-destructive/20";
  // Tickets
  if (s === "open") return "bg-warning/15 text-warning border-warning/20";
  if (s === "in_progress" || s === "in progress") return "bg-primary/10 text-primary border-primary/20";
  if (s === "resolved") return "bg-success/15 text-success border-success/20";
  if (s === "closed") return "bg-muted text-foreground/70 border-border";
  // QR Codes
  if (s === "generated") return "bg-secondary text-secondary-foreground border-transparent";
  if (s === "printed") return "bg-primary/10 text-primary border-primary/20";
  return "bg-accent text-accent-foreground border-accent/20";
};

const labelFor = (raw?: string | null) => {
  const s = (raw || "").toString();
  if (!s) return "-";
  if (s.toLowerCase() === "pending_manager") return "Pending (Manager)";
  if (s.toLowerCase() === "pending_admin") return "Pending (Admin)";
  if (s.toLowerCase() === "in_progress") return "In Progress";
  return s;
};

export function StatusChip({ status, className, size = "md", titleCase = false }: StatusChipProps) {
  const label = titleCase ? labelFor(status).replace(/\b\w/g, (m) => m.toUpperCase()) : labelFor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 font-medium",
        size === "sm" ? "text-[11px] leading-5 py-0" : "text-xs leading-6 py-0.5",
        colorFor(status),
        className,
      )}
    >
      {label}
    </span>
  );
}

export default StatusChip;
