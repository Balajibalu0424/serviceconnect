import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Zap, ToggleLeft, Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: flags = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/feature-flags"] });

  const toggle = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/feature-flags/${id}`, { isEnabled });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      toast({ title: `${data.key} ${data.isEnabled ? "enabled" : "disabled"}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const enabledCount = (flags as any[]).filter((f: any) => f.isEnabled).length;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            Feature Flags
            <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full">
              {enabledCount}/{(flags as any[]).length} active
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Toggle platform features and control rollout percentages</p>
        </div>

        {/* Flags */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-64 bg-muted rounded" />
                    <div className="h-2 w-full bg-muted rounded mt-3" />
                  </div>
                  <div className="w-11 h-6 bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (flags as any[]).length === 0 ? (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold font-outfit mb-1">No feature flags</h3>
              <p className="text-sm text-muted-foreground">Feature flags will appear here once configured.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(flags as any[]).map((flag: any) => (
              <div
                key={flag.id}
                data-testid={`flag-${flag.id}`}
                className={cn(
                  "bg-white/60 dark:bg-black/40 backdrop-blur-xl border rounded-2xl p-5 transition-all duration-200 hover:shadow-md",
                  flag.isEnabled
                    ? "border-green-200/60 dark:border-green-800/30 shadow-sm shadow-green-500/5"
                    : "border-white/40 dark:border-white/10"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        flag.isEnabled ? "bg-green-500" : "bg-muted-foreground/30"
                      )} />
                      <span className="font-mono text-sm font-bold">{flag.key}</span>
                      <Badge
                        variant={flag.isEnabled ? "default" : "secondary"}
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4 rounded-full border-0",
                          flag.isEnabled
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {flag.isEnabled ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{flag.description || "No description"}</p>

                    {/* Rollout bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-medium min-w-[60px]">
                        Rollout: {flag.rolloutPercentage}%
                      </span>
                      <div className="flex-1 max-w-xs">
                        <Progress
                          value={flag.rolloutPercentage}
                          className={cn(
                            "h-1.5",
                            flag.isEnabled ? "bg-green-500/10" : "bg-muted/30"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <Switch
                    checked={flag.isEnabled}
                    onCheckedChange={(checked) => toggle.mutate({ id: flag.id, isEnabled: checked })}
                    disabled={toggle.isPending}
                    data-testid={`toggle-${flag.key}`}
                    className="flex-shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
