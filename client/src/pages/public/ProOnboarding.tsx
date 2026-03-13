import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, setTokens } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Account", "Profile", "Services", "Done"];

export default function ProOnboarding() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", phone: "",
    bio: "", yearsExperience: 1, serviceRadius: 25, location: "",
    specialisations: "",
    categoryIds: [] as string[],
  });

  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const toggleCategory = (id: string) => {
    setForm(f => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter(c => c !== id)
        : [...f.categoryIds, id],
    }));
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/onboarding/professional", {
        ...form,
        specialisations: form.specialisations.split(",").map(s => s.trim()).filter(Boolean),
        yearsExperience: Number(form.yearsExperience),
        serviceRadius: Number(form.serviceRadius),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setTokens(data.accessToken, data.refreshToken);
      await refreshUser();
      setStep(3);
      setTimeout(() => setLocation("/pro/dashboard"), 2000);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">ServiceConnect</span>
          </div>
          <p className="text-sm text-muted-foreground">Join as a Professional</p>
        </div>

        {/* Progress */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all mx-auto",
                i < step ? "bg-primary border-primary text-primary-foreground"
                  : i === step ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
              )}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 flex-1", i < step ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-6 px-0">
          {STEPS.map(s => <span key={s} className="flex-1 text-center">{s}</span>)}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 0: Account */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First name *</Label>
                    <Input value={form.firstName} onChange={e => update("firstName", e.target.value)}
                      placeholder="John" data-testid="input-firstname" />
                  </div>
                  <div>
                    <Label>Last name *</Label>
                    <Input value={form.lastName} onChange={e => update("lastName", e.target.value)}
                      placeholder="Smith" data-testid="input-lastname" />
                  </div>
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={e => update("email", e.target.value)}
                    placeholder="john@example.com" data-testid="input-email" />
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input type="password" value={form.password} onChange={e => update("password", e.target.value)}
                    placeholder="Min. 8 characters" minLength={8} data-testid="input-password" />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                    placeholder="+353 87 123 4567" data-testid="input-phone" />
                </div>
              </>
            )}

            {/* Step 1: Profile */}
            {step === 1 && (
              <>
                <div>
                  <Label>Bio *</Label>
                  <Textarea value={form.bio} onChange={e => update("bio", e.target.value)}
                    placeholder="Tell customers about yourself, your experience, and what makes you great…"
                    rows={4} data-testid="input-bio" />
                </div>
                <div>
                  <Label>Location (county / city)</Label>
                  <Input value={form.location} onChange={e => update("location", e.target.value)}
                    placeholder="e.g. Dublin, Cork, Galway" data-testid="input-location" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Years experience</Label>
                    <Input type="number" min={0} max={50} value={form.yearsExperience}
                      onChange={e => update("yearsExperience", e.target.value)} data-testid="input-experience" />
                  </div>
                  <div>
                    <Label>Service radius (km)</Label>
                    <Input type="number" min={5} max={200} value={form.serviceRadius}
                      onChange={e => update("serviceRadius", e.target.value)} data-testid="input-radius" />
                  </div>
                </div>
                <div>
                  <Label>Specialisations (comma separated)</Label>
                  <Input value={form.specialisations} onChange={e => update("specialisations", e.target.value)}
                    placeholder="e.g. Emergency repairs, Boiler installation, Radiators"
                    data-testid="input-specialisations" />
                </div>
              </>
            )}

            {/* Step 2: Categories */}
            {step === 2 && (
              <>
                <p className="text-sm text-muted-foreground">Select the services you offer (choose all that apply)</p>
                <div className="grid grid-cols-2 gap-2">
                  {(categories as any[]).map((cat: any) => (
                    <button key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      data-testid={`cat-${cat.id}`}
                      className={cn(
                        "p-3 rounded-xl border-2 text-left transition-all text-sm font-medium",
                        form.categoryIds.includes(cat.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      )}>
                      {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
                {form.categoryIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{form.categoryIds.length} service{form.categoryIds.length !== 1 ? "s" : ""} selected</p>
                )}
              </>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="text-center py-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-lg font-bold">Welcome to ServiceConnect!</h2>
                <p className="text-sm text-muted-foreground">
                  Your professional account is ready. You've been given 20 starter credits.
                </p>
                <p className="text-xs text-muted-foreground">Redirecting to your dashboard…</p>
              </div>
            )}

            {/* Navigation */}
            {step < 3 && (
              <div className="flex justify-between pt-2">
                {step > 0 ? (
                  <Button variant="outline" onClick={() => setStep(s => s - 1)} size="sm">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                ) : (
                  <div />
                )}
                {step < 2 ? (
                  <Button onClick={() => setStep(s => s + 1)} size="sm"
                    disabled={step === 0 && (!form.firstName || !form.email || !form.password)}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={loading} data-testid="button-submit-pro">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create account
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
