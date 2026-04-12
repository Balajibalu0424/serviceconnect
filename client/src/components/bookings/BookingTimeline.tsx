import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ArrowRight } from "lucide-react";

export interface BookingTimelineProps {
  booking: {
    status: string;
    createdAt: string | Date;
    completedAt?: string | Date | null;
    originalQuoteId?: string | null;
  };
  compact?: boolean;
}

export function BookingTimeline({ booking, compact = false }: BookingTimelineProps) {
  // Define standard linear progression
  const steps = [
    { id: "CONFIRMED", label: "Confirmed" },
    { id: "IN_PROGRESS", label: "In Progress" },
    { id: "COMPLETED", label: "Completed" }
  ];

  // Determine current step index based on status
  // Note: CANCELLED or DISPUTED break the standard flow
  const isCancelled = booking.status === "CANCELLED";
  const isDisputed = booking.status === "DISPUTED";
  
  let currentStepIndex = 0;
  if (booking.status === "CONFIRMED") currentStepIndex = 0;
  if (booking.status === "IN_PROGRESS") currentStepIndex = 1;
  if (booking.status === "COMPLETED") currentStepIndex = 2;

  // Render a compact version
  if (compact) {
    if (isCancelled || isDisputed) {
      return (
        <div className="flex items-center gap-2 text-sm">
          {isCancelled ? <XCircle className="w-4 h-4 text-red-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
          <span className="font-medium text-red-600 dark:text-red-400 capitalize">{booking.status.toLowerCase()}</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium flex-wrap">
        {steps.map((step, idx) => {
          const isPastOrCurrent = idx <= currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <div key={step.id} className="flex items-center">
              <span className={cn(
                "px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors",
                isCurrent ? "bg-primary/10 text-primary border border-primary/20" : 
                isPastOrCurrent ? "text-primary/70" : "text-muted-foreground opacity-50"
              )}>
                {isPastOrCurrent ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <ArrowRight className={cn("hidden sm:block w-3 h-3 mx-1", isPastOrCurrent ? "text-primary/40" : "text-muted-foreground/30")} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Render the full vertical/detailed timeline
  return (
    <div className="space-y-0 relative">
      {/* Starting point (Quote Acceptance) */}
      <div className="relative pl-7 pb-6 border-l-2 border-primary/30 ml-2">
        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-3 h-3" />
        </div>
        <div className="-mt-1">
          <p className="text-sm font-semibold">Booking Confirmed</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(booking.createdAt).toLocaleDateString("en-IE", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {isCancelled ? (
        <div className="relative pl-7 pb-2 ml-2">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <XCircle className="w-3 h-3" />
          </div>
          <div className="-mt-1">
            <p className="text-sm font-semibold text-red-600">Cancelled</p>
            <p className="text-xs text-muted-foreground mt-0.5">This booking has been cancelled.</p>
          </div>
        </div>
      ) : isDisputed ? (
        <div className="relative pl-7 pb-2 ml-2">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-3 h-3" />
          </div>
          <div className="-mt-1">
            <p className="text-sm font-semibold text-red-600">Disputed</p>
            <p className="text-xs text-muted-foreground mt-0.5">Please contact support.</p>
          </div>
        </div>
      ) : (
        <>
          <div className={cn("relative pl-7 pb-6 border-l-2 transition-colors ml-2", currentStepIndex >= 1 ? "border-primary/30" : "border-muted")}>
            <div className={cn("absolute -left-[9px] top-0 w-4 h-4 rounded-full flex items-center justify-center shadow-sm transition-colors", currentStepIndex >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              {currentStepIndex >= 1 ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3 opacity-50" />}
            </div>
            <div className="-mt-1">
              <p className={cn("text-sm transition-colors", currentStepIndex >= 1 ? "font-semibold" : "text-muted-foreground font-medium")}>In Progress</p>
              {currentStepIndex >= 1 && <p className="text-xs text-muted-foreground mt-0.5">Work has started</p>}
            </div>
          </div>

          <div className="relative pl-7 pb-2 ml-2">
            {currentStepIndex >= 2 ? (
              <>
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
                <div className="-mt-1">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Completed</p>
                  {booking.completedAt && (
                     <p className="text-xs text-muted-foreground mt-0.5">
                       {new Date(booking.completedAt).toLocaleDateString("en-IE", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                     </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="-mt-1">
                  <p className="text-sm font-medium text-muted-foreground/60">Completed</p>
                  <p className="text-xs text-muted-foreground/40 mt-0.5">Awaiting completion</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
