import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Glass-morphism panel used by every section across the app. Replaces the
 * recurring `bg-white/60 dark:bg-black/40 backdrop-blur-xl border ...` string
 * so every section shares the exact same surface.
 */
export interface SurfaceProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
}

export function Surface({
  children,
  className,
  padded = false,
  as: Component = "div",
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden",
        padded && "p-5 md:p-6",
        className,
      )}
    >
      {children}
    </Component>
  );
}

/**
 * Header strip used inside Surface panels for section titles + optional
 * actions. Matches what dashboards already do ad-hoc.
 */
export function SurfaceHeader({
  title,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-5 md:px-6 py-4 border-b border-border/50 bg-white/40 dark:bg-white/5 flex items-center justify-between gap-3",
        className,
      )}
    >
      <h2 className="text-base font-bold font-outfit flex items-center gap-2 min-w-0 truncate">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default Surface;
