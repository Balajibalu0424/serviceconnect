import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, setTokens } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Loader2,
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen,
  Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator,
  Shield, Star, CreditCard, BadgeCheck, Users, TrendingUp, Wifi, Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import AiOnboardingFlow, { type AiOnboardingData } from "@/components/onboarding/AiOnboardingFlow";
const ICON_MAP: Record<string, any> = {
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen,
  Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator
};

const STEPS = ["Your Trade", "About You", "Account", "Done"];

// Value props shown on the right side panel
const VALUE_PROPS = [
  { icon: CreditCard, title: "20 free starter credits", desc: "No card required. Start finding leads today." },
  { icon: Shield, title: "Real leads only", desc: "Every job is AI quality-screened before it goes live." },
  { icon: BadgeCheck, title: "Credits never expire", desc: "Unlike other platforms — yours to keep forever." },
  { icon: TrendingUp, title: "Aftercare follow-up", desc: "We chase customers so you don't have to." },
];

const SOCIAL_PROOF = [
  { name: "Dermot W.", trade: "Plumber, Dublin", quote: "Converted 4 out of 5 jobs I unlocked. The leads are real." },
  { name: "Siobhan B.", trade: "Electrician, Cork", quote: "Much better than the other lot. Customers actually respond." },
];

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
    availableOnline: false,
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

  const handleAiOnboardingComplete = (data: AiOnboardingData) => {
    setForm(f => ({
      ...f,
      categoryIds: data.categoryIds && data.categoryIds.length > 0 ? data.categoryIds : f.categoryIds,
      bio: data.bio || f.bio,
      location: data.location || data.locationText || f.location,
      yearsExperience: data.yearsExperience || f.yearsExperience,
      serviceRadius: data.serviceRadius || f.serviceRadius,
    }));
    setStep(2); // Skip straight to account creation
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/onboarding/professional", {
        ...form,
        specialisations: form.specialisations.split(",").map(s => s.trim()).filter(Boolean),
        yearsExperience: Number(form.yearsExperience),
        serviceRadius: Number(form.serviceRadius),
        availability: { availableOnline: form.availableOnline },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setTokens(data.accessToken, data.refreshToken);
      await refreshUser();
      setStep(3);
      setTimeout(() => setLocation("/pro/dashboard"), 2500);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep0 = form.categoryIds.length > 0;
  const canProceedStep1 = form.bio.length >= 20 && form.location.length > 0;
  const canProceedStep2 = form.firstName && form.lastName && form.email && form.password.length >= 8;

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal nav */}
      <nav className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-bold">ServiceConnect</span>
            </div>
          </Link>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
        <div className="grid lg:grid-cols-5 gap-10 items-start">

          {/* Main form — 3 cols */}
          <div className="lg:col-span-3">
            {/* Step indicator */}
            {step < 3 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  {STEPS.slice(0, 3).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                        i < step ? "bg-primary border-primary text-white"
                          : i === step ? "border-primary text-primary bg-primary/5"
                          : "border-muted text-muted-foreground"
                      )}>
                        {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={cn("text-sm font-medium hidden sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
                      {i < 2 && <div className={cn("h-px w-6 sm:w-10", i < step ? "bg-primary" : "bg-muted")} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 0: Conversational Onboarding */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-1">Let's build your profile</h1>
                  <p className="text-muted-foreground mb-4">Chat with our AI assistant to set up your professional profile in seconds.</p>
                  
                  <AiOnboardingFlow 
                    mode="PROFESSIONAL" 
                    onComplete={handleAiOnboardingComplete}
                  />
                </div>
                
                <p className="text-center text-xs text-muted-foreground mt-4">
                  Prefer the old way? <button className="text-primary hover:underline font-medium" onClick={() => setStep(0.5)}>Use classic form</button>
                </p>
              </div>
            )}

            {/* Step 0.5: Trade Selection (classic form fallback) */}
            {step === 0.5 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">What services do you offer?</h1>
                  <p className="text-muted-foreground">Select all that apply — customers will find you based on these</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(categories as any[]).map((cat: any) => {
                    const Icon = ICON_MAP[cat.icon] || Wrench;
                    const selected = form.categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 group",
                          selected ? "border-primary bg-primary/8 ring-1 ring-primary/20" : "border-border"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors",
                          selected ? "bg-primary/15" : "bg-muted group-hover:bg-primary/10"
                        )}>
                          <Icon className={cn("w-5 h-5", selected ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <p className={cn("font-medium text-sm", selected ? "text-primary" : "")}>{cat.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">€{cat.baseCreditCost}/lead</p>
                        {selected && (
                          <div className="flex items-center gap-1 mt-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs text-primary font-medium">Selected</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {form.categoryIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {form.categoryIds.length} service{form.categoryIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}

                <Button
                  className="w-full gap-2 h-12 text-base"
                  onClick={() => setStep(1)}
                  disabled={!canProceedStep0}
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Step 1: About You (classic form fallback) */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">Tell customers about yourself</h1>
                  <p className="text-muted-foreground">A strong profile gets more jobs. Be specific about your experience.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bio" className="text-sm font-medium">
                      Your bio <span className="text-muted-foreground font-normal">(min. 20 characters)</span>
                    </Label>
                    <Textarea
                      id="bio"
                      value={form.bio}
                      onChange={e => update("bio", e.target.value)}
                      placeholder="e.g. RECI-registered electrician with 8 years experience in domestic and commercial work. Specialise in rewires, consumer units, EV charger installation and fault finding. All work certified and insured."
                      rows={5}
                      className="mt-1.5"
                    />
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-muted-foreground">Be specific — mention qualifications, specialities, certifications</p>
                      <p className={cn("text-xs", form.bio.length < 20 ? "text-muted-foreground" : "text-green-600")}>{form.bio.length} chars</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="location">Where are you based?</Label>
                    <Input
                      id="location"
                      value={form.location}
                      onChange={e => update("location", e.target.value)}
                      placeholder="e.g. Dublin, Cork, Galway"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Years of experience</Label>
                      <Input
                        type="number" min={0} max={50} value={form.yearsExperience}
                        onChange={e => update("yearsExperience", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Service radius (km)</Label>
                      <Input
                        type="number" min={5} max={200} value={form.serviceRadius}
                        onChange={e => update("serviceRadius", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  {/* Available online toggle */}
                  <div
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      form.availableOnline ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => update("availableOnline", !form.availableOnline)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        form.availableOnline ? "bg-primary/15" : "bg-muted"
                      }`}>
                        <Wifi className={`w-4 h-4 ${form.availableOnline ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${form.availableOnline ? "text-primary" : ""}`}>Available for online / remote work</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Shows a green badge on your profile — attracts remote clients</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                      form.availableOnline ? "bg-primary" : "bg-muted-foreground/30"
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        form.availableOnline ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </div>
                  </div>

                  <div>
                    <Label>Specialisations <span className="text-muted-foreground font-normal">(optional, comma separated)</span></Label>
                    <Input
                      value={form.specialisations}
                      onChange={e => update("specialisations", e.target.value)}
                      placeholder="e.g. Emergency repairs, Boiler installation, EV charger install"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(0.5)} className="gap-1.5">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button className="flex-1 gap-2 h-12" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Account details */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">Create your account</h1>
                  <p className="text-muted-foreground">You'll get <strong>20 free credits</strong> to start unlocking leads — no card needed.</p>
                </div>

                {/* Summary of selections */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Your profile summary</p>
                    <div className="flex flex-wrap gap-1.5">
                      {form.categoryIds.map(id => {
                        const cat = (categories as any[]).find((c: any) => c.id === id);
                        return cat ? <Badge key={id} variant="secondary" className="text-xs">{cat.name}</Badge> : null;
                      })}
                    </div>
                    {form.location && <p className="text-xs text-muted-foreground mt-2">📍 {form.location} · {form.serviceRadius}km radius</p>}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First name *</Label>
                      <Input
                        value={form.firstName} onChange={e => update("firstName", e.target.value)}
                        placeholder="John" className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Last name *</Label>
                      <Input
                        value={form.lastName} onChange={e => update("lastName", e.target.value)}
                        placeholder="Smith" className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Email address *</Label>
                    <Input
                      type="email" value={form.email} onChange={e => update("email", e.target.value)}
                      placeholder="john@example.com" className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label>Phone number <span className="text-muted-foreground font-normal">(recommended)</span></Label>
                    <Input
                      type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                      placeholder="+353 87 123 4567" className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Customers with Standard unlocks can see your phone number</p>
                  </div>

                  <div>
                    <Label>Password *</Label>
                    <Input
                      type="password" value={form.password} onChange={e => update("password", e.target.value)}
                      placeholder="Min. 8 characters" minLength={8} className="mt-1.5"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(0)} className="gap-1.5">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button
                    className="flex-1 gap-2 h-12 text-base"
                    onClick={handleSubmit}
                    disabled={loading || !canProceedStep2}
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Account & Get 20 Credits"}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  By creating an account you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="text-center py-8 space-y-5">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-2">Welcome to ServiceConnect, {form.firstName}!</h1>
                  <p className="text-muted-foreground">Your professional account is ready. You've been given <strong>20 starter credits</strong>.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                  {[
                    { label: "Browse Live Jobs", desc: "See what's in your area" },
                    { label: "20 Free Credits", desc: "Ready to unlock leads" },
                    { label: "Complete Profile", desc: "More trust = more jobs" },
                    { label: "Elite Pro Path", desc: "Earn badge via hires & reviews" },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-left">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">Taking you to your dashboard…</p>
              </div>
            )}
          </div>

          {/* Right side — value props panel (desktop only) */}
          {step < 3 && (
            <div className="hidden lg:block lg:col-span-2 space-y-6 pt-16">
              <div>
                <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800 mb-3">
                  Why ServiceConnect?
                </Badge>
                <h3 className="text-xl font-bold mb-2">Real leads. Fair prices. Credits that never expire.</h3>
                <p className="text-sm text-muted-foreground">Bark profits from bad leads. We profit only when jobs get done.</p>
              </div>

              <div className="space-y-4">
                {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-5 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What pros say</p>
                {SOCIAL_PROOF.map(r => (
                  <div key={r.name} className="p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex gap-0.5 mb-2">
                      {[1,2,3,4,5].map(s => <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="text-xs text-foreground mb-2">"{r.quote}"</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{r.name[0]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.name} · {r.trade}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>2,500+ professionals already on ServiceConnect</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
