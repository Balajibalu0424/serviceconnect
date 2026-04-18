import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CUSTOMER_ONBOARDING_PATH,
  PROFESSIONAL_ONBOARDING_PATH,
} from "@/lib/publicRoutes";
import { Sparkles, Shield, Zap, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useTurnstile } from "@/components/Turnstile";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const captcha = useTurnstile("login");

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "PROFESSIONAL") setLocation("/pro/dashboard");
      else if (user.role === "ADMIN") setLocation("/admin");
      else setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha.ready) {
      toast({ title: "Please complete the verification", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const loggedInUser = await login(email, password, captcha.token);
      if (loggedInUser.role === "PROFESSIONAL") setLocation("/pro/dashboard");
      else if (loggedInUser.role === "ADMIN") setLocation("/admin");
      else setLocation("/dashboard");
    } catch (e: any) {
      const msg = e.message || "Invalid email or password";
      setError(msg);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-violet-600 to-blue-700 text-white p-12 flex-col justify-between overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-20 left-1/3 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-violet-300/10 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl" />

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
            Ireland's Smartest<br />
            Service Marketplace
          </h2>
          <p className="text-blue-100 text-lg max-w-md leading-relaxed">
            AI-powered matching connects you with verified local professionals in minutes, not days.
          </p>

          <div className="space-y-5 pt-4">
            {[
              { icon: Sparkles, text: "AI-enhanced job descriptions for better matches" },
              { icon: Shield, text: "Every professional verified and reviewed" },
              { icon: Zap, text: "Average response time under 2 hours" },
            ].map((feat) => (
              <div key={feat.text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  <feat.icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-sm text-blue-50">{feat.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-blue-200">
          &copy; 2026 ServiceConnect. Built in Ireland 🇮🇪
        </p>
      </div>

      {/* Right — Login Form */}
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

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to your account to continue</p>
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
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium" data-testid="link-forgot-password">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
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
                {captcha.widget}
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 rounded-xl font-semibold gap-2 group"
                  disabled={loading || !captcha.ready}
                  data-testid="button-submit"
                >
                  {loading ? "Signing in..." : "Sign in"}
                  {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href={CUSTOMER_ONBOARDING_PATH} className="text-blue-600 hover:text-blue-700 font-medium hover:underline">Start customer onboarding</Link>
              {" "}or{" "}
              <Link href={PROFESSIONAL_ONBOARDING_PATH} className="text-blue-600 hover:text-blue-700 font-medium hover:underline">join as a professional</Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Admin? <Link href="/admin/login" className="text-blue-600 hover:underline">Admin login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
