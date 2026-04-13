import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle, ArrowLeft, Shield } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Extract token from the hash query string: #/reset-password?token=xxx
  useEffect(() => {
    const hash = window.location.hash; // e.g. "#/reset-password?token=abc123"
    const queryStart = hash.indexOf("?");
    if (queryStart !== -1) {
      const params = new URLSearchParams(hash.slice(queryStart + 1));
      const t = params.get("token");
      if (t) setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed. The link may have expired.");
      } else {
        setSuccess(true);
        toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      }
    } catch {
      setError("A network error occurred. Please try again.");
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
        <div className="relative space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight">Set a New<br />Password</h2>
          <p className="text-blue-100 text-lg max-w-md leading-relaxed">
            Choose a strong, unique password. It must be at least 8 characters long.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-sm text-blue-50">Reset links are single-use and expire after 1 hour.</span>
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

          {!success ? (
            <>
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight">Set new password</h1>
                <p className="text-muted-foreground">Your new password must be at least 8 characters.</p>
              </div>

              <Card className="border-border/50 shadow-xl shadow-blue-500/5">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium" role="alert">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                        </svg>
                        {error}
                      </div>
                    )}

                    {!token && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                        No reset token found. Please use the link from your email, or{" "}
                        <Link href="/forgot-password" className="underline font-medium">request a new one</Link>.
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">New password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          required
                          minLength={8}
                          className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20 pr-10"
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your new password"
                        required
                        className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20"
                        data-testid="input-confirm-password"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 rounded-xl font-semibold"
                      disabled={loading || !token}
                      data-testid="button-submit"
                    >
                      {loading ? "Saving..." : "Set new password"}
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
                <h1 className="text-3xl font-extrabold tracking-tight">Password updated!</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Your password has been changed successfully. You can now sign in with your new credentials.
                </p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                Sign in now
              </Button>
            </div>
          )}

          {!success && (
            <div className="text-center">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
