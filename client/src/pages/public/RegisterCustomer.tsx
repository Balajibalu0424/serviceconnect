import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Shield, Zap, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function RegisterCustomer() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!phone || phone.trim().length < 7) {
      toast({ title: "Phone number required", description: "Please enter a valid phone number (at least 7 digits) to continue.", variant: "destructive" });
      setLoading(false);
      return;
    }
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        phone,
        role: "CUSTOMER"
      });
      
      const token = getAccessToken();
      if (token) {
        setLocation("/dashboard");
      }
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
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
            Find the perfect<br />
            professional instantly.
          </h2>
          <p className="text-blue-100 text-lg max-w-md leading-relaxed">
            Join thousands of customers who trust ServiceConnect to get jobs done right.
          </p>

          <div className="space-y-5 pt-4">
            {[
              { icon: Sparkles, text: "AI matches you with the best pros" },
              { icon: Shield, text: "All professionals are vetted & verified" },
              { icon: Zap, text: "Get quotes within hours" },
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

      {/* Right — Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 my-auto py-8">
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
            <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground">Sign up as a customer to hire top local pros</p>
          </div>

          <Card className="border-border/50 shadow-xl shadow-blue-500/5">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="John"
                      required
                      className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                      className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+353 8X XXX XXXX"
                    required
                    className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="h-11 rounded-xl border-border/60 focus:border-blue-500 focus:ring-blue-500/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">Must be at least 8 characters</p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 rounded-xl font-semibold gap-2 group mt-2"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create Account"}
                  {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">Sign in</Link>
            </p>
            <p className="text-muted-foreground">
              Are you a professional?{" "}
              <Link href="/pro/onboarding" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">Join as a Pro</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
