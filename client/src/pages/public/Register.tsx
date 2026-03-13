import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, setTokens } from "@/lib/queryClient";

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", { ...form, role: "PROFESSIONAL" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      setLocation("/pro/dashboard");
      toast({ title: "Welcome to ServiceConnect!", description: "Your professional account has been created." });
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/"><div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg">ServiceConnect</span>
          </div></Link>
          <h1 className="text-2xl font-bold">Join as a Professional</h1>
          <p className="text-muted-foreground mt-1">Get 20 free credits to start finding leads</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} required data-testid="input-firstname" /></div>
                <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} required data-testid="input-lastname" /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required data-testid="input-email" /></div>
              <div><Label>Phone</Label><Input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+353..." data-testid="input-phone" /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} minLength={8} required data-testid="input-password" /></div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
                {loading ? "Creating account..." : "Create Professional Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
        <p className="text-center text-sm text-muted-foreground mt-1">
          Need a job done? <Link href="/post-job" className="text-primary hover:underline">Post a job</Link>
        </p>
      </div>
    </div>
  );
}
