import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared page header used across customer, professional and admin list/detail pages.
 * Ensures consistent hierarchy: gradient title + description + optional eyebrow + action slot.
 *
 * Example:
 *   <PageHeader
 *     eyebrow="Customer"
 *     title="My Jobs"
 *     description="Everything you've posted. Track status, quotes and bookings."
 *     actions={<Button>Post a job</Button>}
 *   />
 */
export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end justify-between gap-4",
        className,
      )}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit text-foreground flex items-center gap-3">
          {icon && (
            <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-indigo-500/15 text-primary items-center justify-center border border-primary/20 shrink-0">
              {icon}
            </span>
          )}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 dark:from-white dark:to-white/70">
            {title}
          </span>
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm max-w-2xl">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
