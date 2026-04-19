import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared empty state used across list, detail and dashboard pages.
 * Replaces ad-hoc "icon + text + button" blocks so every empty screen reads
 * the same way: clear headline, why-it's-empty copy, one primary CTA, optional
 * secondary CTA.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  tone?: "default" | "info" | "warning" | "success";
  className?: string;
  compact?: boolean;
}

const toneBg: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  default: "bg-muted/40 text-muted-foreground",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tone = "default",
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center mx-auto",
        compact ? "py-8 px-4" : "py-14 md:py-20 px-6",
        "bg-white/50 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/5 shadow-sm",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "rounded-2xl flex items-center justify-center mb-4 shrink-0",
            compact ? "w-12 h-12" : "w-16 h-16",
            toneBg[tone],
          )}
        >
          {icon}
        </div>
      )}
      <h3
        className={cn(
          "font-semibold font-outfit text-foreground",
          compact ? "text-sm" : "text-base md:text-lg",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-md mx-auto mt-1.5",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-5">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
