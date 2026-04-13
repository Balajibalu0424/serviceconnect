import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhoneVerificationModalProps {
  open: boolean;
  onVerified: () => void;
  onDismiss?: () => void;
  phone?: string | null;
}

export default function PhoneVerificationModal({
  open,
  onVerified,
  onDismiss,
  phone,
}: PhoneVerificationModalProps) {
  const [step, setStep] = useState<"send" | "verify">("send");
  const [code, setCode] = useState("");
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-phone-otp", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.alreadyVerified) {
        onVerified();
        return;
      }
      setFallbackCode(data.deliveryMode === "DEV_FALLBACK" ? data.fallbackCode ?? null : null);
      setStep("verify");
      toast({
        title: "Code sent",
        description:
          data.deliveryMode === "DEV_FALLBACK" && data.fallbackCode
            ? `Provider fallback is active locally. Use ${data.fallbackCode}.`
            : "Check your phone for the 6-digit verification code.",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) {
      toast({ title: "Please enter the full 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-phone-otp", { code });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Phone verified!", description: "Your number has been confirmed." });
      onVerified();
    } catch (e: any) {
      toast({ title: "Invalid code", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onDismiss?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              {step === "send" ? (
                <Phone className="w-5 h-5 text-blue-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <DialogTitle className="text-base">
              {step === "send" ? "Verify your phone number" : "Enter your code"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {step === "send" ? (
              <>
                We need to verify your phone number{phone ? ` ending in ${phone.slice(-4)}` : ""} before your job goes live.
                This protects professionals from ghost enquiries.
              </>
            ) : (
              "Enter the 6-digit code we sent to your phone. It expires in 10 minutes."
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "send" ? (
          <div className="flex flex-col gap-3 mt-2">
            <Button onClick={sendOtp} disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send verification code"}
            </Button>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="text-gray-400 text-xs">
                I'll do this later
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="otp-input">Verification code</Label>
              <Input
                id="otp-input"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="text-center text-xl tracking-[0.3em] font-mono h-12"
                onKeyDown={e => e.key === "Enter" && verifyOtp()}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
              {fallbackCode && (
                <p className="text-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  Provider fallback is active locally. Use <span className="font-mono">{fallbackCode}</span>.
                </p>
              )}
            </div>
            <Button onClick={verifyOtp} disabled={loading || code.length !== 6} className="w-full">
              {loading ? "Verifying..." : "Confirm code"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCode(""); void sendOtp(); }}
              className="text-gray-400 text-xs"
            >
              Resend code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
