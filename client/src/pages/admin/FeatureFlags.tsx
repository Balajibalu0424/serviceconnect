import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: flags = [] } = useQuery<any[]>({ queryKey: ["/api/admin/feature-flags"] });

  const toggle = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/feature-flags/${id}`, { isEnabled });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      toast({ title: `${data.key} ${data.isEnabled ? "enabled" : "disabled"}` });
    }
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">Feature Flags</h1>
        <div className="space-y-3">
          {(flags as any[]).map((flag: any) => (
            <Card key={flag.id} data-testid={`flag-${flag.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm font-mono">{flag.key}</p>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                    <p className="text-xs text-muted-foreground">Rollout: {flag.rolloutPercentage}%</p>
                  </div>
                  <Switch checked={flag.isEnabled} onCheckedChange={(checked) => toggle.mutate({ id: flag.id, isEnabled: checked })}
                    data-testid={`toggle-${flag.key}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
