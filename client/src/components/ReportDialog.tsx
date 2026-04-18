import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type ReportTargetType = "MESSAGE" | "USER" | "REVIEW" | "JOB";

const REASONS: { value: string; label: string }[] = [
  { value: "SPAM", label: "Spam" },
  { value: "HARASSMENT", label: "Harassment or abuse" },
  { value: "FRAUD", label: "Fraud or scam" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "CONTACT_SHARING", label: "Sharing contact details off-platform" },
  { value: "OFF_PLATFORM", label: "Trying to move off ServiceConnect" },
  { value: "SAFETY", label: "Safety concern" },
  { value: "OTHER", label: "Other" },
];

interface ReportDialogProps {
  targetType: ReportTargetType;
  targetId: string;
  trigger?: React.ReactNode;
  label?: string;
  iconOnly?: boolean;
}

export function ReportDialog({ targetType, targetId, trigger, label, iconOnly }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("SPAM");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/reports", { targetType, targetId, reason, details });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to submit report");
      toast({
        title: "Report submitted",
        description: payload.deduplicated
          ? "You already reported this recently — we have it on file."
          : "Thanks. Our trust & safety team will review this.",
      });
      setOpen(false);
      setDetails("");
      setReason("SPAM");
    } catch (err) {
      toast({
        title: "Could not submit report",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button variant="ghost" size={iconOnly ? "icon" : "sm"} className="text-muted-foreground hover:text-destructive" data-testid={`report-${targetType.toLowerCase()}`}>
      <Flag className="w-3.5 h-3.5" />
      {!iconOnly && <span className="ml-1.5 text-xs">{label ?? "Report"}</span>}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this {targetType.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Reports are reviewed by our trust &amp; safety team. Please do not include personal data of third parties.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`text-left text-xs rounded-md border px-3 py-2 transition-colors ${
                    reason === r.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What happened?"
            />
            <p className="text-[10px] text-muted-foreground text-right">{details.length}/1000</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</> : "Submit report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
