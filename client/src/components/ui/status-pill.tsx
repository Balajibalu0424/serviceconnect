import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Single, canonical status pill used by every list/detail page across customer,
 * professional and admin areas. Centralises status → colour mapping so a
 * "COMPLETED" booking looks the same in admin as it does on the customer side.
 *
 * Known statuses are colour-coded automatically. Anything unknown falls back to
 * a neutral grey so unknown/new statuses never blow up the UI.
 */

export type StatusPillTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "progress"
  | "muted";

export interface StatusPillProps {
  status: string;
  label?: string;
  tone?: StatusPillTone;
  icon?: ReactNode;
  size?: "xs" | "sm" | "md";
  className?: string;
}

// Canonical status → tone map, shared across all three roles.
const STATUS_TONE: Record<string, StatusPillTone> = {
  // Jobs
  DRAFT: "muted",
  LIVE: "info",
  IN_DISCUSSION: "info",
  BOOSTED: "warning",
  AFTERCARE_2D: "warning",
  AFTERCARE_5D: "warning",
  CLOSED: "muted",

  // Bookings
  PENDING: "warning",
  CONFIRMED: "info",
  ACTIVE: "info",
  IN_PROGRESS: "progress",
  COMPLETED: "success",
  CANCELLED: "danger",
  DISPUTED: "danger",

  // Quotes
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "muted",
  WITHDRAWN: "muted",

  // Admin / user states
  ACTIVE_USER: "success",
  SUSPENDED: "danger",
  BANNED: "danger",
  VERIFIED: "success",
  UNVERIFIED: "muted",

  // Support tickets
  OPEN: "info",
  IN_REVIEW: "progress",
  RESOLVED: "success",

  // Reports
  PENDING_REVIEW: "warning",
  ACTIONED: "success",
  DISMISSED: "muted",

  // Payments
  PAID: "success",
  REFUNDED: "info",
  FAILED: "danger",
};

// Default label humaniser: "IN_PROGRESS" → "In progress".
export function humaniseStatus(status: string): string {
  if (!status) return "";
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TONE_CLASS: Record<StatusPillTone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60",
  info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/60",
  success:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/60",
  warning:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60",
  danger:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/60",
  progress:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800/60",
  muted:
    "bg-muted/50 text-muted-foreground border-border/40",
};

const SIZE_CLASS = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-[11px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
};

export function StatusPill({
  status,
  label,
  tone,
  icon,
  size = "sm",
  className,
}: StatusPillProps) {
  const resolvedTone: StatusPillTone = tone ?? STATUS_TONE[status] ?? "neutral";
  const text = label ?? humaniseStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold rounded-full border tracking-wide",
        TONE_CLASS[resolvedTone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {icon}
      {text}
    </span>
  );
}

export default StatusPill;
