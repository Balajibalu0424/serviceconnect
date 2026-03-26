import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, setTokens } from "@/lib/queryClient";
import { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator, CheckCircle, ArrowRight, ArrowLeft, AlertTriangle, Lightbulb, Flame, Clock, Users, Star, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator };

type Step = 1 | 1.5 | 2 | 2.5 | 3 | 4;

interface AiAnalysis {
  quality: { score: number; passed: boolean; prompt: string | null; issues: string[] };
  category: { categorySlug: string | null; confidence: string; reason: string };
  urgency: { isUrgent: boolean; detectedKeywords: string[] };
}

// Bark-style category-specific questionnaires
const CATEGORY_QUESTIONS: Record<string, { label: string; type: "radio" | "select" | "checkbox" | "input"; options?: string[] }[]> = {
  "house-cleaning": [
    { label: "Type of property", type: "radio", options: ["House", "Apartment / Flat", "Office / Commercial"] },
    { label: "Size of property", type: "select", options: ["Studio / 1-bed", "2 bedrooms", "3 bedrooms", "4 bedrooms", "5+ bedrooms"] },
    { label: "How often do you need cleaning?", type: "radio", options: ["One-off clean", "Weekly", "Fortnightly", "Monthly"] },
    { label: "Type of clean needed", type: "checkbox", options: ["General clean", "Deep clean", "End of tenancy", "After builders", "Oven clean"] },
    { label: "Do you have your own supplies?", type: "radio", options: ["Yes", "No — cleaner to bring"] },
  ],
  "plumbing": [
    { label: "What type of plumbing issue?", type: "radio", options: ["Leaking tap / pipe", "Blocked drain", "Boiler / heating", "New installation", "Emergency"] },
    { label: "Location in property", type: "select", options: ["Kitchen", "Bathroom", "Utility room", "Outdoors", "Multiple areas"] },
    { label: "How urgent is this?", type: "radio", options: ["It can wait a few days", "This week if possible", "As soon as possible", "Emergency — water is running"] },
    { label: "Property type", type: "radio", options: ["House", "Apartment", "Commercial"] },
  ],
  "electrical": [
    { label: "What electrical work is needed?", type: "radio", options: ["Fault finding / repair", "New sockets or lights", "Consumer unit / fuse board", "EV charger install", "Full rewire", "Other"] },
    { label: "Is this an emergency?", type: "radio", options: ["No — planning ahead", "Fairly urgent", "Yes — power is out"] },
    { label: "Property type", type: "radio", options: ["Home", "Commercial / Office", "New build"] },
    { label: "Do you have a RECI registered electrician preference?", type: "radio", options: ["Yes — RECI only", "No preference"] },
  ],
  "gardening": [
    { label: "What garden work do you need?", type: "checkbox", options: ["Lawn mowing / cutting", "Hedge trimming", "Garden design", "Weeding", "Planting / landscaping", "Tree work"] },
    { label: "Garden size", type: "radio", options: ["Small (under 50m²)", "Medium (50–150m²)", "Large (150m²+)"] },
    { label: "How often?", type: "radio", options: ["One-off", "Weekly maintenance", "Monthly maintenance", "Seasonal tidy-up"] },
  ],
  "painting-decorating": [
    { label: "What needs painting?", type: "checkbox", options: ["Interior walls", "Exterior walls", "Ceilings", "Woodwork / skirting", "Doors / windows"] },
    { label: "Number of rooms", type: "select", options: ["1 room", "2–3 rooms", "4–5 rooms", "Whole house"] },
    { label: "Will you supply paint?", type: "radio", options: ["Yes — paint already chosen", "No — decorator to advise", "Not sure yet"] },
    { label: "Condition of walls", type: "radio", options: ["Good — just needs a coat", "Needs filling / minor repairs", "Needs significant prep work"] },
  ],
  "carpentry": [
    { label: "Type of carpentry work", type: "radio", options: ["Fitted wardrobes / furniture", "Doors / frames", "Flooring", "Bespoke joinery", "Repairs / restoration", "Other"] },
    { label: "Material preference", type: "radio", options: ["Solid wood", "MDF / engineered wood", "No preference"] },
    { label: "Do you have drawings or plans?", type: "radio", options: ["Yes — plans ready", "No — need advice", "Flexible"] },
  ],
  "removals": [
    { label: "Type of move", type: "radio", options: ["Home move", "Office move", "Single item / furniture", "Storage"] },
    { label: "Move distance", type: "radio", options: ["Local (same city)", "Within Ireland", "International"] },
    { label: "Do you need packing help?", type: "radio", options: ["Yes — full packing service", "Just transport", "Partial packing"] },
    { label: "Property size", type: "select", options: ["Studio / 1-bed", "2–3 bed", "4+ bed", "Office"] },
  ],
  "tutoring": [
    { label: "Subject needed", type: "input" },
    { label: "Student's level", type: "radio", options: ["Primary school", "Junior Cert", "Leaving Cert", "Third level / adult"] },
    { label: "Format preference", type: "radio", options: ["In-person at home", "Online / remote", "Either"] },
    { label: "Sessions per week", type: "radio", options: ["1 session", "2 sessions", "3+ sessions", "One-off / exam prep"] },
  ],
  "photography": [
    { label: "Type of photography", type: "radio", options: ["Wedding / events", "Portrait / headshots", "Product / commercial", "Property", "Other"] },
    { label: "Do you need editing included?", type: "radio", options: ["Yes — edited photos", "Raw files only", "Both"] },
    { label: "Approximate duration needed", type: "radio", options: ["Under 2 hours", "Half day", "Full day", "Multi-day"] },
  ],
  "fitness": [
    { label: "Type of training", type: "radio", options: ["Personal training", "Nutrition coaching", "Group fitness", "Online coaching", "Yoga / Pilates"] },
    { label: "Goal", type: "radio", options: ["Weight loss", "Muscle building", "Improving fitness", "Sports performance", "Rehab / recovery"] },
    { label: "Sessions needed", type: "radio", options: ["Once a week", "2–3 times a week", "Daily", "One-off assessment"] },
    { label: "Location preference", type: "radio", options: ["At my home", "At a gym", "Outdoors", "Online"] },
  ],
};

// Social proof per category — realistic Ireland numbers
const CATEGORY_SOCIAL_PROOF: Record<string, { available: number; recent: number }> = {
  "house-cleaning": { available: 23, recent: 41 },
  "plumbing": { available: 18, recent: 29 },
  "electrical": { available: 12, recent: 22 },
  "gardening": { available: 31, recent: 54 },
  "painting-decorating": { available: 16, recent: 38 },
  "carpentry": { available: 9, recent: 17 },
  "removals": { available: 8, recent: 21 },
  "tutoring": { available: 27, recent: 33 },
  "photography": { available: 14, recent: 19 },
  "fitness": { available: 21, recent: 28 },
};

const DEFAULT_SOCIAL_PROOF = { available: 11, recent: 18 };

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function QualityBar({ score, passed }: { score: number; passed: boolean }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  const label = score >= 70 ? "Great description" : score >= 40 ? "Good — could be better" : "Needs more detail";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">AI quality score</span>
        <span className={cn("font-medium", score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600")}>
          {score}/100 — {label}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// Processing / loading screen
function ProcessingScreen({ categorySlug }: { categorySlug: string }) {
  const [phase, setPhase] = useState(0);
  const phases = [
    "Evaluating your requirements…",
    "Checking pro availability in your area…",
    "Matching to verified professionals…",
    "Almost ready — preparing your matches…",
  ];
  useEffect(() => {
    const id = setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 900);
    return () => clearInterval(id);
  }, []);
  const proof = CATEGORY_SOCIAL_PROOF[categorySlug] || DEFAULT_SOCIAL_PROOF;
  return (
    <div className="text-center space-y-8 py-6">
      {/* Animated spinner */}
      <div className="relative w-20 h-20 mx-auto">
        <div className="w-20 h-20 rounded-full border-4 border-muted animate-spin border-t-primary" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="w-7 h-7 text-primary" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-lg font-semibold">{phases[phase]}</p>
        <div className="h-1 bg-muted rounded-full max-w-xs mx-auto overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${((phase + 1) / phases.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Trust widget */}
      <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
        {[
          { icon: Users, value: `${proof.available}`, label: "pros available" },
          { icon: Star, value: "4.8★", label: "avg rating" },
          { icon: Clock, value: "<2h", label: "avg response" },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="bg-muted/40 rounded-lg p-3">
            <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-base font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Trustpilot-style widget */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-green-500 text-green-500" />)}
        </div>
        <span className="text-muted-foreground">Excellent · <strong className="text-foreground">4.8</strong> on Trustpilot</span>
      </div>

      <p className="text-xs text-muted-foreground animate-pulse">
        {proof.recent} people in Ireland requested this service in the last hour
      </p>
    </div>
  );
}

export default function PostJob() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedCategory = params.get("category") || "";
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);

  // Category questionnaire answers
  const [catAnswers, setCatAnswers] = useState<Record<string, string | string[]>>({});
  // Hiring intent
  const [hiringIntent, setHiringIntent] = useState("");

  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const [job, setJob] = useState({
    categoryId: preselectedCategory,
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    urgency: "NORMAL",
    locationText: "",
    preferredDate: "",
  });

  const [account, setAccount] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: "",
    password: "",
  });

  const isLoggedIn = !!user;

  // Get category slug for questionnaire lookup
  const selectedCat = (categories as any[]).find((c: any) => c.id === job.categoryId);
  const categorySlug = selectedCat?.slug || "";
  const categoryQuestions = CATEGORY_QUESTIONS[categorySlug] || [];
  const socialProof = CATEGORY_SOCIAL_PROOF[categorySlug] || DEFAULT_SOCIAL_PROOF;

  // Debounce title + description for live analysis
  const debouncedTitle = useDebounce(job.title, 600);
  const debouncedDescription = useDebounce(job.description, 600);
  const debouncedLocation = useDebounce(job.locationText, 600);

  useEffect(() => {
    if (!debouncedTitle && !debouncedDescription) return;
    if (debouncedTitle.length < 3 && debouncedDescription.length < 10) return;

    const analyze = async () => {
      setAnalyzing(true);
      try {
        const res = await apiRequest("POST", "/api/jobs/analyze", {
          title: debouncedTitle,
          description: debouncedDescription,
          locationText: debouncedLocation || null,
          categoryId: job.categoryId || null,
        });
        if (res.ok) {
          const data = await res.json();
          setAiAnalysis(data);
          if (!job.categoryId && data.category.categorySlug && data.category.confidence !== "LOW") {
            const suggestedCat = (categories as any[]).find(c => c.slug === data.category.categorySlug);
            if (suggestedCat) {
              setJob(j => ({ ...j, categoryId: suggestedCat.id }));
              toast({ title: `Category auto-detected: ${suggestedCat.name}`, description: `AI matched to ${suggestedCat.name}. You can change this.` });
            }
          }
          if (data.urgency.isUrgent && job.urgency === "NORMAL") {
            setJob(j => ({ ...j, urgency: "URGENT" }));
          }
        }
      } catch (_) {}
      finally { setAnalyzing(false); }
    };
    analyze();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedDescription, debouncedLocation]);

  const handleJobSubmit = async () => {
    if (!job.categoryId || !job.title || !job.description) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    // If we have category-specific questions, go to step 1.5
    if (categoryQuestions.length > 0) {
      setStep(1.5);
    } else {
      setStep(2);
    }
  };

  const handleQuestionsNext = () => {
    setStep(2);
  };

  const handleAccountSubmit = async () => {
    setLoading(true);
    setShowProcessing(false);
    try {
      // Inject questionnaire answers + hiring intent into description as rich context
      let enrichedDescription = job.description;
      if (Object.keys(catAnswers).length > 0 || hiringIntent) {
        const extras: string[] = [];
        Object.entries(catAnswers).forEach(([q, a]) => {
          extras.push(`${q}: ${Array.isArray(a) ? a.join(", ") : a}`);
        });
        if (hiringIntent) extras.push(`Timeline: ${hiringIntent}`);
        enrichedDescription += "\n\n[Additional details]\n" + extras.join("\n");
      }
      const jobPayload = { ...job, description: enrichedDescription };

      if (isLoggedIn) {
        // Show fake processing screen for 2.5s then submit
        setStep(2.5);
        await new Promise(r => setTimeout(r, 2500));
        const res = await apiRequest("POST", "/api/jobs", jobPayload);
        const data = await res.json();
        if (!res.ok) {
          if (data.code === "QUALITY_GATE_FAILED") {
            toast({ title: "Job needs more detail", description: data.qualityPrompt || "Please improve your description.", variant: "destructive" });
            setStep(1);
            return;
          }
          throw new Error(data.error);
        }
        setJobId(data.id);
        setStep(4);
        toast({ title: "Job posted!", description: data.aiAnalysis?.urgency?.isUrgent ? "🚨 Urgent — pros are being notified now!" : "Your job is now live." });
        await refreshUser();
        return;
      }

      // New user — show processing then onboarding
      setStep(2.5);
      await new Promise(r => setTimeout(r, 2500));
      const res = await apiRequest("POST", "/api/onboarding/customer", { ...account, ...jobPayload });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      setJobId(data.jobId);
      setNeedsVerify(true);
      await refreshUser();
      setStep(3);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/onboarding/customer/verify", { otp });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshUser();
      setStep(4);
      toast({ title: "Email verified!", description: "Your job is now live." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = isLoggedIn ? 3 : 4;
  const stepNum = step === 1 ? 1 : step === 1.5 ? 1 : step === 2 ? 2 : step === 2.5 ? 2 : step === 3 ? 3 : 4;
  const progressPct = ((stepNum - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold">ServiceConnect</span>
          </Link>
          {isLoggedIn
            ? <Link href="/dashboard"><Button variant="ghost" size="sm">My Dashboard</Button></Link>
            : <p className="text-sm text-muted-foreground hidden sm:block">Free to post · No account needed to start</p>
          }
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress — hide on processing and done screens */}
        {step !== 2.5 && step !== 4 && (
          <div className="mb-8">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {stepNum} of {totalSteps}</span>
              <span>{Math.round(progressPct)}% complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              {["Job Details", !isLoggedIn ? "Your Account" : "Confirm", !isLoggedIn ? "Verify" : "", "Done"].filter(Boolean).map((label, i) => (
                <span key={i} className={cn("text-xs", i + 1 === stepNum ? "text-primary font-medium" : "text-muted-foreground")}>{label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Job Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">What do you need done?</h1>
              <p className="text-muted-foreground">Tell us about your job — it's free to post</p>
            </div>

            {/* Social proof banner */}
            {categorySlug && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{socialProof.available} pros</strong> available in your area · <strong>{socialProof.recent} people</strong> requested this in the last hour</span>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-3 block">Select a category</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {(categories as any[]).map((cat: any) => {
                  const Icon = ICON_MAP[cat.icon] || Wrench;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setJob(j => ({ ...j, categoryId: cat.id }))}
                      className={cn(
                        "p-3 rounded-lg border-2 text-center transition-all",
                        job.categoryId === cat.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}
                      data-testid={`category-${cat.slug}`}
                    >
                      <Icon className={cn("w-5 h-5 mx-auto mb-1", job.categoryId === cat.id ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-xs font-medium leading-tight">{cat.name}</div>
                    </button>
                  );
                })}
              </div>
              {!job.categoryId && aiAnalysis?.category.categorySlug && aiAnalysis.category.confidence !== "LOW" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Lightbulb className="w-3 h-3 text-yellow-500 shrink-0" />
                  <span>AI suggests: <strong>{aiAnalysis.category.categorySlug}</strong> — select above to confirm</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="title">Job title</Label>
              <Input id="title" value={job.title} onChange={e => setJob(j => ({...j, title: e.target.value}))}
                placeholder="e.g. Fix leaking tap in kitchen" required data-testid="input-title" />
            </div>

            <div>
              <Label htmlFor="description">
                <span>Describe the job</span>
                {analyzing && <span className="ml-2 text-xs text-muted-foreground animate-pulse">analysing…</span>}
              </Label>
              <Textarea id="description" value={job.description} onChange={e => setJob(j => ({...j, description: e.target.value}))}
                placeholder="Provide as much detail as possible — size, material, location in property, any relevant history…" rows={4} required data-testid="input-description" />
              {aiAnalysis && (job.title.length > 3 || job.description.length > 10) && (
                <div className="mt-2 space-y-2">
                  <QualityBar score={aiAnalysis.quality.score} passed={aiAnalysis.quality.passed} />
                  {!aiAnalysis.quality.passed && aiAnalysis.quality.prompt && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                      <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-600" />
                      <span>{aiAnalysis.quality.prompt}</span>
                    </div>
                  )}
                  {aiAnalysis.urgency.isUrgent && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                      <Flame className="w-3.5 h-3.5 shrink-0" />
                      <span>Urgent job detected — pros will be notified immediately.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budgetMin">Budget from (€)</Label>
                <Input id="budgetMin" type="number" value={job.budgetMin} onChange={e => setJob(j => ({...j, budgetMin: e.target.value}))} placeholder="50" data-testid="input-budget-min" />
              </div>
              <div>
                <Label htmlFor="budgetMax">Budget to (€)</Label>
                <Input id="budgetMax" type="number" value={job.budgetMax} onChange={e => setJob(j => ({...j, budgetMax: e.target.value}))} placeholder="200" data-testid="input-budget-max" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Urgency</Label>
                <Select value={job.urgency} onValueChange={v => setJob(j => ({...j, urgency: v}))}>
                  <SelectTrigger data-testid="select-urgency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low — flexible</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High — this week</SelectItem>
                    <SelectItem value="URGENT">Urgent — ASAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred date</Label>
                <Input type="date" value={job.preferredDate} onChange={e => setJob(j => ({...j, preferredDate: e.target.value}))} data-testid="input-date" />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Your location</Label>
              <Input id="location" value={job.locationText} onChange={e => setJob(j => ({...j, locationText: e.target.value}))}
                placeholder="e.g. Ranelagh, Dublin 6" data-testid="input-location" />
            </div>

            {aiAnalysis && !aiAnalysis.quality.passed && job.description.length > 20 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div><strong>Improve your description</strong> to get better quotes. Jobs with quality above 40 go live instantly.</div>
              </div>
            )}

            <Button className="w-full gap-2" onClick={handleJobSubmit} data-testid="button-next">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>

            {categoryQuestions.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                A few quick questions about your {selectedCat?.name} job next →
              </p>
            )}
          </div>
        )}

        {/* Step 1.5: Category-Specific Questionnaire */}
        {step === 1.5 && categoryQuestions.length > 0 && (
          <div className="space-y-6">
            <div>
              <Badge variant="secondary" className="mb-2">{selectedCat?.name}</Badge>
              <h1 className="text-2xl font-bold mb-1">A few more details</h1>
              <p className="text-muted-foreground">These help pros give you accurate quotes</p>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span><strong>{socialProof.available} pros</strong> are available in your area right now</span>
            </div>

            <div className="space-y-6">
              {categoryQuestions.map((q, qi) => (
                <div key={qi} className="space-y-3">
                  <Label className="text-sm font-semibold">{q.label}</Label>

                  {q.type === "radio" && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCatAnswers(a => ({ ...a, [q.label]: opt }))}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left text-sm transition-all",
                            catAnswers[q.label] === opt ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40"
                          )}
                        >
                          <span className={cn("w-4 h-4 rounded-full border-2 inline-block mr-2 align-middle",
                            catAnswers[q.label] === opt ? "border-primary bg-primary" : "border-muted-foreground"
                          )} />
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === "select" && q.options && (
                    <Select value={(catAnswers[q.label] as string) || ""} onValueChange={v => setCatAnswers(a => ({ ...a, [q.label]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                      <SelectContent>
                        {q.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {q.type === "checkbox" && q.options && (
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map(opt => {
                        const selected = (catAnswers[q.label] as string[] || []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const curr = (catAnswers[q.label] as string[]) || [];
                              setCatAnswers(a => ({
                                ...a,
                                [q.label]: selected ? curr.filter(x => x !== opt) : [...curr, opt]
                              }));
                            }}
                            className={cn(
                              "p-2.5 rounded-lg border-2 text-left text-sm transition-all flex items-center gap-2",
                              selected ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
                            )}
                          >
                            <div className={cn("w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center",
                              selected ? "border-primary bg-primary" : "border-muted-foreground"
                            )}>
                              {selected && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "input" && (
                    <Input
                      value={(catAnswers[q.label] as string) || ""}
                      onChange={e => setCatAnswers(a => ({ ...a, [q.label]: e.target.value }))}
                      placeholder="Type your answer…"
                    />
                  )}
                </div>
              ))}

              {/* Hiring intent question */}
              <div className="space-y-3 pt-2 border-t border-border">
                <Label className="text-sm font-semibold">How soon do you need this done?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {["Within 24 hours", "This week", "In the next 2 weeks", "Next month or later", "I'm just getting quotes"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setHiringIntent(opt)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left text-sm transition-all",
                        hiringIntent === opt ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40"
                      )}
                    >
                      {opt === "Within 24 hours" && <Flame className="w-3.5 h-3.5 text-red-500 inline mr-1.5" />}
                      {opt}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">This helps pros prioritise your job and respond faster</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="gap-2" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleQuestionsNext} data-testid="button-questions-next">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Account */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">{isLoggedIn ? "Confirm your details" : "Create your account"}</h1>
              <p className="text-muted-foreground">{isLoggedIn ? "Review before posting" : "Free to join — get quotes fast"}</p>
            </div>

            {/* AI summary + hiring intent */}
            {(aiAnalysis || hiringIntent) && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4 space-y-2">
                  {aiAnalysis && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Job quality</span>
                      <Badge variant={aiAnalysis.quality.passed ? "default" : "secondary"}>{aiAnalysis.quality.score}/100</Badge>
                    </div>
                  )}
                  {hiringIntent && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Timeline: <strong className="text-foreground">{hiringIntent}</strong></span>
                    </div>
                  )}
                  {aiAnalysis?.urgency.isUrgent && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600">
                      <Flame className="w-3.5 h-3.5" /><span>Urgent — pros notified instantly on post</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!isLoggedIn && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input value={account.firstName} onChange={e => setAccount(a => ({...a, firstName: e.target.value}))} required data-testid="input-firstname" /></div>
                  <div><Label>Last Name</Label><Input value={account.lastName} onChange={e => setAccount(a => ({...a, lastName: e.target.value}))} required data-testid="input-lastname" /></div>
                </div>
                <div><Label>Email address</Label><Input type="email" value={account.email} onChange={e => setAccount(a => ({...a, email: e.target.value}))} required data-testid="input-email" /></div>
                <div><Label>Phone number</Label><Input type="tel" value={account.phone} onChange={e => setAccount(a => ({...a, phone: e.target.value}))} placeholder="+353..." data-testid="input-phone" /></div>
                <div><Label>Create password</Label><Input type="password" value={account.password} onChange={e => setAccount(a => ({...a, password: e.target.value}))} minLength={8} required data-testid="input-password" /></div>
              </>
            )}
            {isLoggedIn && (
              <Card><CardContent className="pt-4 space-y-2 text-sm">
                <p><strong>Job:</strong> {job.title}</p>
                <p><strong>Category:</strong> {(categories as any[]).find((c: any) => c.id === job.categoryId)?.name}</p>
                <p><strong>Location:</strong> {job.locationText}</p>
                {Object.entries(catAnswers).slice(0, 2).map(([k, v]) => (
                  <p key={k} className="text-muted-foreground text-xs">{k}: {Array.isArray(v) ? v.join(", ") : v}</p>
                ))}
                {hiringIntent && <p className="text-xs text-muted-foreground">Timeline: {hiringIntent}</p>}
              </CardContent></Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setStep(categoryQuestions.length > 0 ? 1.5 : 1)}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleAccountSubmit} disabled={loading} data-testid="button-submit">
                {loading ? "Processing..." : isLoggedIn ? "Post Job" : "Create Account & Post"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {!isLoggedIn && (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
                </p>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[{ icon: "🔒", text: "No spam ever" }, { icon: "💳", text: "Free forever" }, { icon: "⚡", text: "Quotes within hours" }].map(t => (
                    <div key={t.text} className="text-center p-2 rounded-lg bg-muted/40">
                      <p className="text-base">{t.icon}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2.5: Processing Screen */}
        {step === 2.5 && (
          <ProcessingScreen categorySlug={categorySlug} />
        )}

        {/* Step 3: OTP Verification */}
        {step === 3 && (needsVerify || !isLoggedIn) && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">Verify your email</h1>
              <p className="text-muted-foreground">Enter the 6-digit code sent to {account.email}</p>
              <p className="text-xs text-accent font-medium mt-1">Demo mode — use code: <strong className="font-mono">123456</strong></p>
            </div>
            <div className="max-w-xs mx-auto">
              <Input type="text" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="123456" className="text-center text-2xl tracking-widest h-14 font-mono" data-testid="input-otp" />
            </div>
            <Button className="w-full gap-2" onClick={handleOtpVerify} disabled={loading || otp.length !== 6} data-testid="button-verify">
              {loading ? "Verifying..." : "Verify & Go Live"} <CheckCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Your job is live!</h1>
              <p className="text-muted-foreground mb-1">Professionals in your area are being notified right now.</p>
              <p className="text-sm text-muted-foreground">Most customers hear back within a few hours.</p>
            </div>

            {/* Live social proof */}
            <div className="flex items-center justify-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-400 max-w-sm mx-auto">
              <Users className="w-4 h-4 shrink-0" />
              <span><strong>{socialProof.available} pros</strong> in your area have been notified</span>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto text-left">
              {[
                { step: "1", text: "Pros see your job and send quotes" },
                { step: "2", text: "Compare quotes in your dashboard" },
                { step: "3", text: "Accept the best one & get sorted" },
              ].map(s => (
                <div key={s.step} className="p-3 rounded-lg bg-muted/40">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mb-2">{s.step}</div>
                  <p className="text-xs text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <Link href="/dashboard"><Button className="w-full">Watch quotes come in →</Button></Link>
              <Link href="/post-job"><Button variant="outline" className="w-full">Post Another Job</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
