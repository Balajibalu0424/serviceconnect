import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, TrendingDown, TrendingUp, Gift, Zap, CheckCircle, Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface CreditPackage {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonusCredits: number;
  description?: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const PACKAGE_ICONS = ["⚡", "🚀", "💼", "🏆"];
const PACKAGE_COLORS = [
  "border-border",
  "border-primary ring-1 ring-primary/30",
  "border-border",
  "border-amber-400 ring-1 ring-amber-400/30",
];

const TX_ICONS: Record<string, any> = {
  PURCHASE: TrendingUp,
  SPEND: TrendingDown,
  BONUS: Gift,
  REFUND: TrendingUp,
  ADMIN_GRANT: Gift,
  UPGRADE: TrendingDown,
};

const TX_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  SPEND: "Spent",
  BONUS: "Bonus",
  REFUND: "Refund",
  ADMIN_GRANT: "Admin Grant",
  UPGRADE: "Upgrade",
};

export default function ProCredits() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"confirm" | "payment" | "success">("confirm");
  // Fake card fields for Stripe scaffold
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  const { data: packages = [] } = useQuery<CreditPackage[]>({ queryKey: ["/api/credits/packages"] });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/credits/transactions"] });

  const purchase = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest("POST", "/api/credits/purchase", { packageId });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/credits/transactions"] });
      refreshUser();
      setCheckoutStep("success");
      toast({
        title: "Credits added!",
        description: `${data.creditsAdded} credits have been added to your account.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Payment failed", description: e.message, variant: "destructive" });
      setProcessingPayment(false);
    },
  });

  const openCheckout = (pkg: CreditPackage) => {
    setSelectedPkg(pkg);
    setCheckoutStep("confirm");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setProcessingPayment(false);
  };

  const closeCheckout = () => {
    setSelectedPkg(null);
    setCheckoutStep("confirm");
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkg) return;
    setProcessingPayment(true);
    // Stripe scaffold: simulate payment intent creation + confirmation
    // In production, create PaymentIntent server-side, then confirmCardPayment with Stripe.js
    await new Promise(r => setTimeout(r, 1200)); // simulate processing
    purchase.mutate(selectedPkg.id);
  };

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Credits</h1>
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-bold text-primary" data-testid="text-credit-balance">
              {user?.creditBalance || 0} credits
            </span>
          </div>
        </div>

        {/* How credits work */}
        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">FREE tier</p>
                  <p className="text-muted-foreground text-xs">Chat only, contact info masked</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">STANDARD unlock</p>
                  <p className="text-muted-foreground text-xs">Spend credits to reveal phone &amp; book</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Gift className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Earn free credits</p>
                  <p className="text-muted-foreground text-xs">Spin the wheel every 72h</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Packages */}
        <div>
          <h2 className="font-semibold mb-3">Buy Credits</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(packages as CreditPackage[]).map((pkg, i) => (
              <Card
                key={pkg.id}
                className={`relative transition-shadow hover:shadow-md cursor-pointer ${PACKAGE_COLORS[i] || "border-border"}`}
                data-testid={`package-${pkg.id}`}
                onClick={() => openCheckout(pkg)}
              >
                <CardContent className="pt-4 pb-4 text-center">
                  {pkg.name === "Popular" && (
                    <Badge className="mb-2 text-xs absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      Most Popular
                    </Badge>
                  )}
                  <div className="text-2xl mb-1">{PACKAGE_ICONS[i] || "💳"}</div>
                  <p className="font-bold">{pkg.name}</p>
                  <p className="text-2xl font-bold text-primary mt-1">€{pkg.price}</p>
                  <p className="text-sm text-muted-foreground">
                    {pkg.credits} credits
                    {pkg.bonusCredits > 0 && (
                      <span className="text-accent"> +{pkg.bonusCredits} bonus</span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={e => { e.stopPropagation(); openCheckout(pkg); }}
                    data-testid={`button-buy-${pkg.id}`}
                  >
                    Buy
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Transaction history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {(transactions as Transaction[]).length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(transactions as Transaction[]).map((tx) => {
                  const Icon = TX_ICONS[tx.type] || CreditCard;
                  const isPositive = tx.amount > 0;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3"
                      data-testid={`tx-${tx.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPositive ? "bg-accent/10" : "bg-destructive/10"}`}>
                          <Icon className={`w-4 h-4 ${isPositive ? "text-accent" : "text-destructive"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{tx.description}</p>
                            <Badge variant="outline" className="text-xs py-0">
                              {TX_LABELS[tx.type] || tx.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className={`font-bold text-sm ${isPositive ? "text-accent" : "text-destructive"}`}>
                          {isPositive ? "+" : ""}{tx.amount}
                        </p>
                        <p className="text-xs text-muted-foreground">Bal: {tx.balanceAfter}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={!!selectedPkg} onOpenChange={open => !open && closeCheckout()}>
        <DialogContent className="sm:max-w-md">
          {checkoutStep === "confirm" && selectedPkg && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Purchase</DialogTitle>
                <DialogDescription>Review your order before payment</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-medium">{selectedPkg.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-medium">{selectedPkg.credits}</span>
                  </div>
                  {selectedPkg.bonusCredits > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bonus credits</span>
                      <span className="font-medium text-accent">+{selectedPkg.bonusCredits}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>€{selectedPkg.price}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeCheckout} className="flex-1">Cancel</Button>
                  <Button onClick={() => setCheckoutStep("payment")} className="flex-1" data-testid="button-proceed-to-payment">
                    Proceed to Payment
                  </Button>
                </div>
              </div>
            </>
          )}

          {checkoutStep === "payment" && selectedPkg && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Details</DialogTitle>
                <DialogDescription>
                  Your payment is secured by Stripe · €{selectedPkg.price}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handlePaymentSubmit} className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="cardNumber">Card number</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      required
                      disabled={processingPayment}
                      className="pr-10"
                      data-testid="input-card-number"
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="cardExpiry">Expiry</Label>
                    <Input
                      id="cardExpiry"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      required
                      disabled={processingPayment}
                      data-testid="input-card-expiry"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cardCvc">CVC</Label>
                    <Input
                      id="cardCvc"
                      placeholder="123"
                      value={cardCvc}
                      onChange={e => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      required
                      disabled={processingPayment}
                      data-testid="input-card-cvc"
                    />
                  </div>
                </div>

                <div className="bg-muted/40 rounded p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                  <span>This is a scaffolded Stripe integration. In production, card data goes directly to Stripe — never to our servers.</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCheckoutStep("confirm")}
                    disabled={processingPayment}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={processingPayment} className="flex-1" data-testid="button-pay">
                    {processingPayment ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing...</span>
                    ) : (
                      `Pay €${selectedPkg.price}`
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}

          {checkoutStep === "success" && selectedPkg && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Payment Successful!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedPkg.credits + (selectedPkg.bonusCredits || 0)} credits have been added to your account.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">New balance: </span>
                <span className="font-bold text-primary">{user?.creditBalance || 0} credits</span>
              </div>
              <Button onClick={closeCheckout} className="w-full" data-testid="button-close-success">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
