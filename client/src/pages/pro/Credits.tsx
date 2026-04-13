import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { formatDistanceToNow } from "date-fns";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Gift,
  Infinity,
  Loader2,
  Shield,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

interface CreditPackage {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonusCredits: number;
  description?: string | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface PaymentConfig {
  provider: "STRIPE";
  ready: boolean;
  mode: "LIVE" | "TEST" | "DEMO" | "DISABLED";
  publishableKey: string | null;
  missing: string[];
  message: string;
}

interface PaymentIntentResponse {
  paymentId: string;
  clientSecret: string | null;
  publishableKey: string | null;
  mode: "LIVE" | "TEST" | "DEMO";
  packageSnapshot: {
    id: string;
    name: string;
    price: string;
    currency: string;
    credits: number;
    bonusCredits: number;
    totalCredits: number;
  };
}

interface PaymentRecord {
  id: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  mode: "LIVE" | "TEST" | "DEMO";
  fulfilledAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

type CheckoutStep = "confirm" | "payment" | "processing" | "success";

const PACKAGE_COLORS = [
  "border-border",
  "border-primary ring-1 ring-primary/30",
  "border-border",
  "border-amber-400 ring-1 ring-amber-400/30",
];

const TX_ICONS: Record<string, typeof TrendingUp> = {
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

const COMPARISON = [
  { feature: "Credits expire", bark: "After 3 months", sc: "Never expire" },
  { feature: "Lead exclusivity", bark: "Same lead to 5 pros", sc: "Matchbook - your lead" },
  { feature: "Money-back on first pack", bark: "No guarantee", sc: "Refund if no jobs match" },
  { feature: "Chat before spending", bark: "Pay to contact", sc: "Free chat always" },
  { feature: "Aftercare follow-up", bark: "None", sc: "Automated follow-up" },
];

const cardElementOptions = {
  hidePostalCode: true,
  style: {
    base: {
      color: "#111827",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      "::placeholder": {
        color: "#6b7280",
      },
    },
    invalid: {
      color: "#dc2626",
    },
  },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPaymentStatus(paymentId: string) {
  const res = await apiRequest("GET", `/api/payments/${paymentId}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: "Unable to read payment status." }));
    throw new Error(payload.error || "Unable to read payment status.");
  }
  return res.json() as Promise<PaymentRecord>;
}

async function waitForPaymentFinalization(paymentId: string, attempts = 8, delayMs = 1500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payment = await fetchPaymentStatus(paymentId);
    if (payment.status === "COMPLETED" && payment.fulfilledAt) return payment;
    if (payment.status === "FAILED") throw new Error(payment.failureReason || "Payment failed.");
    if (payment.status === "REFUNDED") throw new Error("Payment was refunded before fulfillment completed.");
    await sleep(delayMs);
  }
  return null;
}

function StripePaymentForm({
  clientSecret,
  amountLabel,
  busy,
  onBack,
  onProviderConfirmed,
}: {
  clientSecret: string;
  amountLabel: string;
  busy: boolean;
  onBack: () => void;
  onProviderConfirmed: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      setSubmitError("Stripe has not finished loading yet.");
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      setSubmitError("Card details are not ready.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message || "Card confirmation failed.");
      if (!result.paymentIntent) throw new Error("Stripe did not return a payment intent.");
      await onProviderConfirmed();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Payment confirmation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">Card details</p>
        <div className="rounded-lg border bg-background px-3 py-3">
          <CardElement options={cardElementOptions} />
        </div>
        <p className="text-xs text-muted-foreground">
          Card details are sent directly to Stripe. ServiceConnect only fulfills credits after the backend confirms the payment.
        </p>
      </div>

      {submitError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting || busy}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!stripe || isSubmitting || busy} data-testid="button-pay">
          {isSubmitting || busy ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : (
            `Pay ${amountLabel}`
          )}
        </Button>
      </div>
    </form>
  );
}

export default function ProCredits() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("confirm");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentIntentResponse | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const { data: packages = [] } = useQuery<CreditPackage[]>({ queryKey: ["/api/credits/packages"] });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/credits/transactions"] });
  const { data: paymentConfig, isLoading: paymentConfigLoading } = useQuery<PaymentConfig>({
    queryKey: ["/api/payments/config"],
  });

  const stripePromise = useMemo(() => {
    const key = paymentConfig?.publishableKey ?? activePayment?.publishableKey;
    return key ? loadStripe(key) : null;
  }, [activePayment?.publishableKey, paymentConfig?.publishableKey]);

  const paymentsReady = Boolean(paymentConfig?.ready && paymentConfig?.publishableKey);
  const isFirstPurchase = transactions.filter((tx) => tx.type === "PURCHASE").length === 0;

  const createPaymentIntent = useMutation({
    mutationFn: async (packageId: string) => {
      const res = await apiRequest("POST", "/api/credits/stripe/payment-intent", { packageId });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to create payment intent.");
      return payload as PaymentIntentResponse;
    },
    onSuccess: (paymentIntent) => {
      setCheckoutError(null);
      setActivePayment(paymentIntent);
      setCheckoutStep("payment");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      setCheckoutError(message);
      toast({ title: "Checkout unavailable", description: message, variant: "destructive" });
    },
  });

  const openCheckout = (pkg: CreditPackage) => {
    setSelectedPkg(pkg);
    setCheckoutStep("confirm");
    setCheckoutError(null);
    setActivePayment(null);
    setVerifyingPayment(false);
  };

  const closeCheckout = () => {
    setSelectedPkg(null);
    setCheckoutStep("confirm");
    setCheckoutError(null);
    setActivePayment(null);
    setVerifyingPayment(false);
  };

  const finalizeCompletedPayment = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/credits/transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/credits/balance"] }),
      refreshUser(),
    ]);
    setCheckoutStep("success");
  };

  const verifyPayment = async (paymentId: string) => {
    setVerifyingPayment(true);
    setCheckoutError(null);
    setCheckoutStep("processing");

    try {
      const finalPayment = await waitForPaymentFinalization(paymentId);
      if (finalPayment) {
        await finalizeCompletedPayment();
        toast({
          title: "Credits added",
          description: `${selectedPkg ? selectedPkg.credits + selectedPkg.bonusCredits : "Your"} credits are now available.`,
        });
        return;
      }

      setCheckoutError("The provider confirmed your payment, but fulfillment is still processing. You can check again in a moment.");
      toast({
        title: "Payment processing",
        description: "Stripe accepted the payment. Credits will appear once the webhook completes.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify payment status.";
      setCheckoutError(message);
      setCheckoutStep("payment");
      toast({ title: "Payment failed", description: message, variant: "destructive" });
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold">Credits</h1>
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="font-bold text-primary" data-testid="text-credit-balance">
              {user?.creditBalance || 0} credits
            </span>
          </div>
        </div>

        {!paymentConfigLoading && paymentConfig && !paymentConfig.ready && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Payments are not configured yet.</p>
                <p>{paymentConfig.message}</p>
                {paymentConfig.missing.length > 0 && (
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    Missing environment variables: {paymentConfig.missing.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              icon: Infinity,
              color: "text-primary",
              bg: "bg-primary/5 border-primary/20",
              title: "Credits never expire",
              desc: "Use them whenever you are ready. No expiry window and no forced spending.",
            },
            {
              icon: Shield,
              color: "text-green-600",
              bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
              title: "Money-back guarantee",
              desc: isFirstPurchase
                ? "Your first pack is refundable if no jobs match within 30 days."
                : "Support can review payment issues and package disputes.",
            },
            {
              icon: Zap,
              color: "text-amber-500",
              bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
              title: "Earn free credits",
              desc: "Spin the wheel every 72 hours for bonus credits and boosts.",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className={`flex items-start gap-3 rounded-xl border p-4 ${bg}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {isFirstPurchase && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-400">First pack - 100% money-back guarantee</p>
              <p className="mt-0.5 text-xs text-green-700 dark:text-green-500">
                Buy your first credit pack risk-free. If you do not get a matched job within 30 days, support can refund the full amount.
              </p>
            </div>
          </div>
        )}

        <Card className="border-dashed bg-muted/40">
          <CardContent className="grid grid-cols-1 gap-4 pb-4 pt-4 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Free tier</p>
                <p className="text-xs text-muted-foreground">Chat remains free while contact info stays masked.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div>
                <p className="font-medium">Standard unlock</p>
                <p className="text-xs text-muted-foreground">Spend credits when you want to reveal contact details and book.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium">Credits control access</p>
                <p className="text-xs text-muted-foreground">You decide when to spend, instead of paying for every lead upfront.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-1 font-semibold">Buy Credits</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            All credits never expire. Stripe powers checkout once payment keys and webhook secrets are configured.
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {packages.map((pkg, index) => (
              <Card
                key={pkg.id}
                className={`relative cursor-pointer transition-shadow hover:shadow-md ${PACKAGE_COLORS[index] || "border-border"}`}
                onClick={() => paymentsReady && openCheckout(pkg)}
                data-testid={`package-${pkg.id}`}
              >
                <CardContent className="pb-4 pt-4 text-center">
                  {pkg.name === "Popular" && (
                    <Badge className="absolute left-1/2 top-[-8px] -translate-x-1/2 whitespace-nowrap text-xs">
                      Most Popular
                    </Badge>
                  )}
                  {index === 0 && isFirstPurchase && (
                    <Badge
                      variant="outline"
                      className="absolute right-2 top-[-8px] whitespace-nowrap border-green-400 bg-green-50 text-xs text-green-600"
                    >
                      <Shield className="mr-1 h-2.5 w-2.5" />
                      Guaranteed
                    </Badge>
                  )}
                  <div className="mb-2 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <p className="font-bold">{pkg.name}</p>
                  <p className="mt-1 text-2xl font-bold text-primary">EUR {pkg.price}</p>
                  <p className="text-sm text-muted-foreground">
                    {pkg.credits} credits
                    {pkg.bonusCredits > 0 && <span className="text-accent"> +{pkg.bonusCredits} bonus</span>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Never expire</p>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (paymentsReady) openCheckout(pkg);
                    }}
                    disabled={!paymentsReady}
                    data-testid={`button-buy-${pkg.id}`}
                  >
                    {paymentsReady ? "Buy" : "Setup needed"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Why ServiceConnect beats Bark
              <Badge variant="secondary" className="text-xs">
                Better credit model
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Feature</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Bark</th>
                    <th className="pb-2 font-medium">ServiceConnect</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{row.feature}</td>
                      <td className="py-2.5 pr-4 text-xs text-destructive">{row.bark}</td>
                      <td className="py-2.5 text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {row.sc}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="py-8 text-center">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Your first completed credit purchase will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((tx) => {
                  const Icon = TX_ICONS[tx.type] || CreditCard;
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-3" data-testid={`tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isPositive ? "bg-accent/10" : "bg-destructive/10"
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isPositive ? "text-accent" : "text-destructive"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{tx.description}</p>
                            <Badge variant="outline" className="py-0 text-xs">
                              {TX_LABELS[tx.type] || tx.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4 shrink-0 text-right">
                        <p className={`text-sm font-bold ${isPositive ? "text-accent" : "text-destructive"}`}>
                          {isPositive ? "+" : ""}
                          {tx.amount}
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

      <Dialog open={!!selectedPkg} onOpenChange={(open) => !open && closeCheckout()}>
        <DialogContent className="sm:max-w-md">
          {checkoutStep === "confirm" && selectedPkg && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Purchase</DialogTitle>
                <DialogDescription>Review your package before Stripe checkout starts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2 rounded-lg bg-muted/50 p-4">
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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits expire</span>
                    <span className="flex items-center gap-1 font-medium text-green-600">
                      <Infinity className="h-3.5 w-3.5" />
                      Never
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>EUR {selectedPkg.price}</span>
                  </div>
                </div>

                {checkoutError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {checkoutError}
                  </div>
                )}

                {isFirstPurchase && (
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400">
                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>Money-back guarantee applies.</strong> Your first credit pack is eligible if no jobs match in 30 days.
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeCheckout} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createPaymentIntent.mutate(selectedPkg.id)}
                    className="flex-1"
                    disabled={createPaymentIntent.isPending || !paymentsReady}
                    data-testid="button-proceed-to-payment"
                  >
                    {createPaymentIntent.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting...
                      </span>
                    ) : (
                      "Proceed to Payment"
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {checkoutStep === "payment" && selectedPkg && activePayment?.clientSecret && stripePromise && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Details</DialogTitle>
                <DialogDescription>
                  Stripe {activePayment.mode === "LIVE" ? "live" : "test"} mode - EUR {selectedPkg.price}
                </DialogDescription>
              </DialogHeader>
              <Elements stripe={stripePromise}>
                <StripePaymentForm
                  clientSecret={activePayment.clientSecret}
                  amountLabel={`EUR ${selectedPkg.price}`}
                  busy={verifyingPayment}
                  onBack={() => {
                    setCheckoutStep("confirm");
                    setCheckoutError(null);
                  }}
                  onProviderConfirmed={async () => {
                    await verifyPayment(activePayment.paymentId);
                  }}
                />
              </Elements>
            </>
          )}

          {checkoutStep === "processing" && selectedPkg && activePayment && (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Payment submitted</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stripe accepted the payment. ServiceConnect is waiting for the webhook to confirm fulfillment before credits are granted.
                </p>
              </div>
              {checkoutError && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                  {checkoutError}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closeCheckout}>
                  Close
                </Button>
                <Button className="flex-1" onClick={() => verifyPayment(activePayment.paymentId)} disabled={verifyingPayment}>
                  {verifyingPayment ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking...
                    </span>
                  ) : (
                    "Check status"
                  )}
                </Button>
              </div>
            </div>
          )}

          {checkoutStep === "success" && selectedPkg && (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <CheckCircle className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Payment Complete</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedPkg.credits + selectedPkg.bonusCredits} credits were added after backend confirmation.
                </p>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">New balance: </span>
                  <span className="font-bold text-primary">{user?.creditBalance || 0} credits</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-green-600">
                  <Infinity className="h-3.5 w-3.5" />
                  <span>These credits never expire.</span>
                </div>
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
