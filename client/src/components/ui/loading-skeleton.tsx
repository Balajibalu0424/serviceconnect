import { cn } from "@/lib/utils";

/**
 * Thin wrappers over the base `Skeleton` component so every list/detail page
 * uses the same loading rhythm. Avoids ad-hoc `animate-pulse` divs that
 * drift in size between screens.
 */

export function ListSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-2xl bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 animate-pulse border border-white/20 dark:border-white/5"
        />
      ))}
    </div>
  );
}

export function StatGridSkeleton({
  tiles = 4,
  className,
}: {
  tiles?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6",
        className,
      )}
    >
      {Array.from({ length: tiles }).map((_, i) => (
        <div
          key={i}
          className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-white/20 dark:border-white/5"
        />
      ))}
    </div>
  );
}

export function PageLoading({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-muted-foreground",
        className,
      )}
    >
      <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default ListSkeleton;
