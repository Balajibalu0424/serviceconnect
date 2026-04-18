import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Sparkles, Shield, Zap, CheckCircle } from "lucide-react";
import { useTurnstile } from "@/components/Turnstile";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const captcha = useTurnstile("forgot-password");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha.ready) {
      toast({ title: "Please complete the verification", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: captcha.token ?? undefined }),
      });
      // Always show success to prevent email enumeration
      setSent(true);
      if (!res.ok) {
        // Silently fail — we still show the success screen for security
        console.warn("Forgot-password response:", res.status);
      }
    } catch {
      // Network error — still show success screen
      toast({
        title: "Request sent",
        description: "If that address is registered, you'll receive a reset link.",
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-violet-600 to-blue-700 text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute top-20 left-1/3 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-violet-300/10 rounded-full blur-3xl" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-xl">ServiceConnect</span>
          </Link>
        </div>
        <div className="relative space-y-8">
          <h2 className="text-4xl font-extrabold leading-tight">
            Secure Account<br />Recovery
          </h2>
          <p className="text-blue-100 text-lg max-w-md leading-relaxed">
            We'll send a secure password reset link to your email. The link expires in 1 hour.
          </p>
          <div className="space-y-5 pt-4">
            {[
              { icon: Shield, text: "Reset links expire after 1 hour for security" },
              { icon: Mail, text: "Check your spam folder if you don't see it" },
              { icon: Zap, text: "Contact support if you no longer have access to your email" },
            ].map((feat) => (
              <div key={feat.text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  <feat.icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-blue-50">{feat.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-blue-200">© 2026 ServiceConnect. Built in Ireland 🇮🇪</p>
      </div>

      {/* Right — Form / Success */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <Link href="/">
              <div className="inline-flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="font-bold text-lg">ServiceConnect</span>
              </div>
            </Link>
          </div>

          {!sent ? (
            <>
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
                <p className="text-muted-foreground">Enter your email and we'll send you a reset link.</p>
              </div>

              <Card className="border-border/50 shadow-xl shadow-blue-500/5">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20"
                        data-testid="input-email"
                      />
                    </div>
                    {captcha.widget}
                    <Button
                      type="submit"
                      className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 rounded-xl font-semibold gap-2"
                      disabled={loading || !captcha.ready}
                      data-testid="button-submit"
                    >
                      {loading ? "Sending..." : "Send reset link"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight">Check your email</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  If <span className="font-medium">{email}</span> is registered, you'll receive a reset link within a few minutes.
                </p>
              </div>
              <Card className="border-border/50 text-left">
                <CardContent className="pt-5 pb-5 space-y-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">The link is valid for <strong>1 hour</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">Check your <strong>spam / junk</strong> folder if it doesn't appear.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">Never share this link — ServiceConnect staff will never ask for it.</span>
                  </div>
                </CardContent>
              </Card>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Try a different email
              </Button>
            </div>
          )}

          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
