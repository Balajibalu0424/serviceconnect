import { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * Canonical glass-morphism stat tile used by every dashboard (customer, pro,
 * admin). Consistent: tinted icon chip, big number, label, small subtext,
 * optional trend delta, optional href wrapper.
 */
export interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  tone?: "indigo" | "blue" | "emerald" | "amber" | "orange" | "violet" | "rose" | "cyan";
  href?: string;
  trend?: { value: number; label?: string };
  className?: string;
}

const TONE: Record<NonNullable<StatTileProps["tone"]>, { bg: string; color: string }> = {
  indigo: { bg: "from-indigo-500/10 to-blue-500/10", color: "text-indigo-600 dark:text-indigo-400" },
  blue: { bg: "from-blue-500/10 to-cyan-500/10", color: "text-blue-500 dark:text-blue-400" },
  emerald: { bg: "from-emerald-500/10 to-green-500/10", color: "text-emerald-600 dark:text-emerald-400" },
  amber: { bg: "from-amber-500/10 to-orange-500/10", color: "text-amber-500 dark:text-amber-400" },
  orange: { bg: "from-orange-500/10 to-amber-500/10", color: "text-orange-500 dark:text-orange-400" },
  violet: { bg: "from-violet-500/10 to-fuchsia-500/10", color: "text-violet-600 dark:text-violet-400" },
  rose: { bg: "from-rose-500/10 to-pink-500/10", color: "text-rose-600 dark:text-rose-400" },
  cyan: { bg: "from-cyan-500/10 to-teal-500/10", color: "text-cyan-600 dark:text-cyan-400" },
};

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "indigo",
  href,
  trend,
  className,
}: StatTileProps) {
  const t = TONE[tone];
  const inner = (
    <div
      className={cn(
        "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 p-5 rounded-2xl shadow-sm group-hover:shadow-md group-hover:border-primary/20 transition-all duration-300 relative overflow-hidden h-full",
        className,
      )}
    >
      <div
        className={cn(
          "absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity",
          t.bg,
        )}
      />
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div
          className={cn(
            "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center border border-white/20 dark:border-white/5",
            t.bg,
            t.color,
          )}
        >
          {icon}
        </div>
        {trend && trend.value > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 border border-emerald-500/20">
            +{trend.value}
            {trend.label ? ` ${trend.label}` : ""}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-bold font-outfit leading-none">{value}</p>
        <p className="text-sm font-medium mt-2 text-foreground/80">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block group">
        {inner}
      </Link>
    );
  }
  return <div className="group">{inner}</div>;
}

export default StatTile;
