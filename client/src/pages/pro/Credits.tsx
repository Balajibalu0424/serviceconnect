import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, TrendingDown, TrendingUp, Gift } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

export default function ProCredits() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: packages = [] } = useQuery<any[]>({ queryKey: ["/api/credits/packages"] });
  const { data: transactions = [] } = useQuery<any[]>({ queryKey: ["/api/credits/transactions"] });

  const purchase = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest("POST", "/api/credits/purchase", { packageId });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/credits/transactions"] });
      refreshUser();
      toast({ title: "Credits purchased!", description: `${data.creditsAdded} credits added. New balance: ${data.newBalance}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const TX_ICONS: Record<string, any> = { PURCHASE: TrendingUp, SPEND: TrendingDown, BONUS: Gift, REFUND: TrendingUp, ADMIN_GRANT: Gift, UPGRADE: TrendingDown };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Credits</h1>
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-bold text-primary">{user?.creditBalance || 0} credits</span>
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Buy Credits</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(packages as any[]).map((pkg: any) => (
              <Card key={pkg.id} className={pkg.name === "Popular" ? "border-primary ring-1 ring-primary/20" : ""} data-testid={`package-${pkg.id}`}>
                <CardContent className="pt-4 pb-4 text-center">
                  {pkg.name === "Popular" && <Badge className="mb-2 text-xs">Most Popular</Badge>}
                  <p className="font-bold">{pkg.name}</p>
                  <p className="text-2xl font-bold text-primary mt-1">€{pkg.price}</p>
                  <p className="text-sm text-muted-foreground">
                    {pkg.credits} credits
                    {pkg.bonusCredits > 0 && <span className="text-accent"> +{pkg.bonusCredits} bonus</span>}
                  </p>
                  <Button size="sm" className="w-full mt-3" onClick={() => purchase.mutate(pkg.id)} disabled={purchase.isPending} data-testid={`button-buy-${pkg.id}`}>
                    Buy
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
          <CardContent>
            {(transactions as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {(transactions as any[]).map((tx: any) => {
                  const Icon = TX_ICONS[tx.type] || CreditCard;
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPositive ? "bg-accent/10" : "bg-destructive/10"}`}>
                          <Icon className={`w-4 h-4 ${isPositive ? "text-accent" : "text-destructive"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${isPositive ? "text-accent" : "text-destructive"}`}>
                          {isPositive ? "+" : ""}{tx.amount}
                        </p>
                        <p className="text-xs text-muted-foreground">Balance: {tx.balanceAfter}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
