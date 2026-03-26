import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@serviceconnect.ie");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // If already logged in as admin, redirect immediately
  useEffect(() => {
    if (user?.role === "ADMIN") setLocation("/admin");
    else if (user?.role === "CUSTOMER") setLocation("/dashboard");
    else if (user?.role === "PROFESSIONAL") setLocation("/pro/dashboard");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser?.role !== "ADMIN") {
        toast({ title: "Access denied", description: "This login is for admin accounts only.", variant: "destructive" });
        return;
      }
      setLocation("/admin");
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-muted-foreground mt-1">ServiceConnect Administration</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-email" /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="input-password" /></div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
                {loading ? "Authenticating..." : "Sign in to Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link href="/login" className="hover:underline">Back to main login</Link>
        </p>
      </div>
    </div>
  );
}
