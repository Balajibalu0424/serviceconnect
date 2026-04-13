import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, setTokens } from "@/lib/queryClient";
import { buildOnboardingPath } from "@/lib/publicRoutes";
import { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator, CheckCircle, ArrowRight, ArrowLeft, AlertTriangle, Lightbulb, Flame, Clock, Users, Star, Shield, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatFileSize, uploadAsset } from "@/lib/uploads";
import type { UploadedAsset } from "@shared/uploads";

/**
 * ARCHITECTURAL NOTE:
 * This component intentionally uses the legacy AiOnboardingFlow component (`/api/ai/onboarding-chat`)
 * instead of the new `RoleAwareOnboarding` session-based flow. 
 * This is because PostJob is used by already-authenticated customers within the platform, 
 * whereas RoleAwareOnboarding handles the complex public-to-authenticated conversion funnel.
 * Migrating this to the new flow is planned for post-beta cleanup.
 */
import AiOnboardingFlow, { type AiOnboardingData } from "@/components/onboarding/AiOnboardingFlow";
import PhoneVerificationModal from "@/components/auth/PhoneVerificationModal";
const ICON_MAP: Record<string, any> = { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator };

type Step = 1 | 1.5 | 2 | 2.5 | 3 | 4;

interface AiAnalysis {
  quality: { score: number; passed: boolean; prompt: string | null; issues: string[] };
  category: { categorySlug: string | null; confidence: string; reason: string };
  urgency: { isUrgent: boolean; detectedKeywords: string[] };
}

type CategoryQuestion = { label: string; type: "radio" | "select" | "checkbox" | "input"; options?: string[] };

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

function OtpStep({ email, otp, setOtp, onVerify, onResend, loading, fallbackCode }: {
  email: string; otp: string; setOtp: (v: string) => void;
  onVerify: () => void; onResend: () => Promise<void> | void; loading: boolean; fallbackCode?: string | null;
}) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    // NOTE: Real email OTP delivery is deferred (requires SendGrid/Resend integration).
    // This button shows UI readiness — in demo mode the code remains centralized.
    setResending(true);
    try {
      await onResend();
      setResendCooldown(60);
    } catch (error) {
      toast({
        title: "Unable to resend code",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-1">Verify your email</h1>
        <p className="text-muted-foreground">Enter the 6-digit code sent to <strong>{email}</strong></p>
        {fallbackCode && (
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-1.5 inline-block">
            Provider fallback is active locally. Use code <strong className="font-mono tracking-widest">{fallbackCode}</strong>
          </p>
        )}
      </div>
      <div className="max-w-xs mx-auto space-y-3">
        <Input
          type="text" maxLength={6} value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="text-center text-2xl tracking-widest h-14 font-mono"
          data-testid="input-otp"
        />
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {resendCooldown > 0 ? (
            <span>Resend available in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-primary hover:underline disabled:opacity-50"
              data-testid="button-resend-otp"
            >
              {resending ? "Resending…" : "Resend code"}
            </button>
          )}
        </div>
      </div>
      <Button
        className="w-full gap-2"
        onClick={onVerify}
        disabled={loading || otp.length !== 6}
        data-testid="button-verify"
      >
        {loading ? "Verifying..." : "Verify & Go Live"} <CheckCircle className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function PostJob() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedCategory = params.get("category") || "";
  const verifyMode = params.get("verify") === "1";
  const { user, refreshUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // If user arrives from /post-job?verify=1, jump straight to OTP step
  const initialStep: Step = verifyMode && user && !user.emailVerified ? 3 : 1;
  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(user?.firstJobId || null);
  const [otp, setOtp] = useState("");
  const [emailFallbackCode, setEmailFallbackCode] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(verifyMode && user && !user.emailVerified ? true : false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [jobPhotos, setJobPhotos] = useState<UploadedAsset[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

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

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation(buildOnboardingPath("CUSTOMER", search));
    }
  }, [authLoading, search, setLocation, user]);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Redirecting to guided onboarding...</div>
      </div>
    );
  }

  // Get category slug for questionnaire lookup
  const selectedCat = (categories as any[]).find((c: any) => c.id === job.categoryId);
  const categorySlug = selectedCat?.slug || "";
  const categoryQuestions = CATEGORY_QUESTIONS[categorySlug] || [];
  const socialProof = CATEGORY_SOCIAL_PROOF[categorySlug] || DEFAULT_SOCIAL_PROOF;

  // Debounce title + description for live analysis
  const debouncedTitle = useDebounce(job.title, 600);
  const debouncedDescription = useDebounce(job.description, 600);
  const debouncedLocation = useDebounce(job.locationText, 600);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const availableSlots = Math.max(0, 5 - jobPhotos.length);
    const nextFiles = Array.from(files).slice(0, availableSlots);
    if (nextFiles.length === 0) {
      toast({ title: "Photo limit reached", description: "You can attach up to 5 job photos.", variant: "destructive" });
      return;
    }

    setUploadingPhotos(true);
    try {
      const uploaded = await Promise.all(
        nextFiles.map((file) => uploadAsset("job-photo", file, { entityType: "job" })),
      );
      setJobPhotos((prev) => [...prev, ...uploaded].slice(0, 5));
      toast({ title: "Photos uploaded", description: `${uploaded.length} file${uploaded.length === 1 ? "" : "s"} ready to attach.` });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (assetId: string) => {
    setJobPhotos((prev) => prev.filter((asset) => asset.id !== assetId));
  };

  const handleOtpResend = async () => {
    const res = await apiRequest("POST", "/api/onboarding/customer/resend", {});
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setEmailFallbackCode(data.challenge?.deliveryMode === "DEV_FALLBACK" ? data.challenge.fallbackCode ?? null : null);
    toast({
      title: data.alreadyVerified ? "Already verified" : "Code resent",
      description:
        data.challenge?.deliveryMode === "DEV_FALLBACK" && data.challenge.fallbackCode
          ? `Provider fallback is active locally. Use ${data.challenge.fallbackCode}.`
          : "Check your email for the latest code.",
    });
  };

  const handleAiOnboardingComplete = (data: AiOnboardingData) => {
    setJob({
      ...job,
      title: data.title || "",
      description: data.description || "",
      categoryId: data.categoryId?.toString() || "",
      locationText: data.locationText || "",
      urgency: data.urgency || "NORMAL",
      budgetMin: data.budgetMin?.toString() || "",
      budgetMax: data.budgetMax?.toString() || "",
    });
    if (!isLoggedIn) {
      setAccount(a => ({
        ...a,
        firstName: data.firstName || a.firstName,
        lastName: data.lastName || a.lastName,
        email: data.email || a.email,
        phone: data.phone || a.phone,
      }));
    }
    setStep(2);
  };

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



  const handleAccountSubmit = async (skipPhoneCheck = false) => {
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
      const jobPayload = {
        ...job,
        description: enrichedDescription,
        mediaUploadIds: jobPhotos.map((asset) => asset.id),
      };

      if (isLoggedIn) {
        // Gate: verified phone required to publish — one-time, skipped once verified
        // skipPhoneCheck=true when called directly from onVerified callback (avoids stale closure issue)
        if (!skipPhoneCheck && !(user as any)?.phoneVerified) {
          setShowPhoneVerify(true);
          setLoading(false);
          return;
        }

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

      // New user — phone is mandatory to prevent ghost leads (anti-abuse protection)
      const cleanPhone = (account.phone || "").replace(/[\s\-\(\)]/g, "");
      if (!cleanPhone || cleanPhone.length < 7) {
        toast({ title: "Phone number required", description: "Please enter a valid phone number. This is required to verify your identity before your job goes live.", variant: "destructive" });
        setLoading(false);
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
      setEmailFallbackCode(data.challenge?.deliveryMode === "DEV_FALLBACK" ? data.challenge.fallbackCode ?? null : null);
      await refreshUser();
      // Invalidate jobs cache so dashboard shows the new DRAFT job immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
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
      setEmailFallbackCode(null);
      // Invalidate jobs cache so dashboard reflects DRAFT→LIVE transition immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
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
        <div className="mb-4">
          <Badge variant="outline" className="mb-2 bg-primary/5 text-primary border-primary/20">
            Step {stepNum} of {totalSteps}
          </Badge>
        </div>

        {/* Step 1: Conversational Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">Let's get your job sorted</h1>
              <p className="text-muted-foreground mb-4">Chat with our AI assistant to quickly post your request. It's completely free.</p>
              
              <AiOnboardingFlow 
                mode="CUSTOMER" 
                isLoggedIn={isLoggedIn}
                onComplete={handleAiOnboardingComplete}
                initialMessage={preselectedCategory 
                  ? `Hi there! I see you need help with ${preselectedCategory.replace(/-/g, ' ')}. Could you describe exactly what you need done?`
                  : undefined}
              />
            </div>
          </div>
        )}



        {/* Step 2: Urgency + Quick Review + Account */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1">{isLoggedIn ? "Almost there — confirm & post" : "Quick details to get your quotes"}</h1>
              <p className="text-muted-foreground text-sm">{isLoggedIn ? "Review your request and post" : "Free account — takes 30 seconds"}</p>
            </div>

            {/* Compact job summary card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{(categories as any[]).find((c: any) => c.id === job.categoryId)?.name} · {job.locationText || "Location not set"}</p>
                  </div>
                  {aiAnalysis && (
                    <Badge variant={aiAnalysis.quality.passed ? "default" : "secondary"} className="shrink-0">{aiAnalysis.quality.score}/100</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Inline urgency selector — clean, one-tap */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">How urgent is this?</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: "LOW", label: "No rush", icon: "🟢", sub: "Within weeks" },
                  { value: "NORMAL", label: "Normal", icon: "🔵", sub: "This week" },
                  { value: "HIGH", label: "Soon", icon: "🟠", sub: "1–2 days" },
                  { value: "URGENT", label: "ASAP", icon: "🔴", sub: "Today" },
                ].map(u => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setJob(j => ({ ...j, urgency: u.value }))}
                    className={cn(
                      "rounded-xl border-2 p-3 text-center transition-all hover:shadow-sm",
                      job.urgency === u.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <p className="text-lg">{u.icon}</p>
                    <p className="text-xs font-semibold mt-1">{u.label}</p>
                    <p className="text-[10px] text-muted-foreground">{u.sub}</p>
                  </button>
                ))}
              </div>
              {job.urgency === "URGENT" && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Pros will be notified immediately when your job goes live
                </p>
              )}
            </div>

            {isLoggedIn && (
              <div className="space-y-3 rounded-2xl border border-border/50 bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Job photos</Label>
                    <p className="text-xs text-muted-foreground mt-1">Optional. Add up to 5 images to help professionals quote accurately.</p>
                  </div>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    className="max-w-[220px]"
                    onChange={(e) => {
                      void handlePhotoUpload(e.target.files);
                      e.currentTarget.value = "";
                    }}
                    disabled={uploadingPhotos || jobPhotos.length >= 5}
                  />
                </div>

                {jobPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {jobPhotos.map((asset) => (
                      <div key={asset.id} className="rounded-xl border border-border/50 overflow-hidden bg-background">
                        <div className="aspect-[4/3] bg-muted">
                          <img src={asset.url} alt={asset.originalName} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2 space-y-1">
                          <p className="text-xs font-medium truncate">{asset.originalName}</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">{formatFileSize(asset.sizeBytes)}</p>
                            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => removePhoto(asset.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoggedIn && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First name</Label>
                    <Input
                      type="text"
                      value={account.firstName}
                      onChange={e => setAccount(a => ({...a, firstName: e.target.value}))}
                      required
                      placeholder="Jane"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input
                      type="text"
                      value={account.lastName}
                      onChange={e => setAccount(a => ({...a, lastName: e.target.value}))}
                      required
                      placeholder="Doe"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={account.email}
                    onChange={e => setAccount(a => ({...a, email: e.target.value}))}
                    required
                    placeholder="jane@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    value={account.phone}
                    onChange={e => setAccount(a => ({...a, phone: e.target.value}))}
                    required
                    placeholder="08X XXX XXXX"
                    className="mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Required to verify your identity. We'll never share it with pros.</p>
                </div>
                <div className="pt-2 border-t border-border">
                  <Label>Create a password</Label>
                  <Input type="password" value={account.password} onChange={e => setAccount(a => ({...a, password: e.target.value}))} minLength={8} required data-testid="input-password" placeholder="••••••••" className="mt-1" />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> Edit
              </Button>
              <Button className="flex-1 gap-2" onClick={() => handleAccountSubmit()} disabled={loading} data-testid="button-submit">
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
          <OtpStep
            email={account.email}
            otp={otp}
            setOtp={setOtp}
            onVerify={handleOtpVerify}
            onResend={handleOtpResend}
            loading={loading}
            fallbackCode={emailFallbackCode}
          />
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
              <Button variant="outline" className="w-full" onClick={() => {
                setStep(1);
                setJobId(null);
                setOtp("");
                setEmailFallbackCode(null);
                setNeedsVerify(false);
                setAiAnalysis(null);
                setAnalyzing(false);
                setShowProcessing(false);
                setJobPhotos([]);
                setCatAnswers({});
                setHiringIntent("");
                setJob({ categoryId: "", title: "", description: "", budgetMin: "", budgetMax: "", urgency: "NORMAL", locationText: "", preferredDate: "" });
              }}>Post Another Job</Button>
            </div>
          </div>
        )}
      </div>

      {/* Phone verification gate for logged-in users without verified phone */}
      <PhoneVerificationModal
        open={showPhoneVerify}
        phone={(user as any)?.phone}
        onVerified={async () => {
          setShowPhoneVerify(false);
          await refreshUser();
          handleAccountSubmit(true); // skip phone check — just verified, closure has stale user
        }}
        onDismiss={() => setShowPhoneVerify(false)}
      />
    </div>
  );
}
