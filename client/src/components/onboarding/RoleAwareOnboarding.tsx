import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, setTokens } from "@/lib/queryClient";
import {
  clearStoredOnboardingSessionId,
  getStoredOnboardingSessionId,
  storeOnboardingSessionId,
} from "@/lib/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { buildOnboardingPath } from "@/lib/publicRoutes";
import type {
  CustomerJobDraft,
  OnboardingCompletionResult,
  OnboardingRole,
  OnboardingSessionState,
  PersonalDetails,
  ProfessionalProfileDraft,
} from "@shared/onboarding";

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
};

type VerificationChallengeFeedback = {
  deliveryMode: "PROVIDER" | "DEV_FALLBACK";
  fallbackCode?: string;
  maskedTarget?: string;
};

const ROLE_META: Record<
  OnboardingRole,
  {
    eyebrow: string;
    headline: string;
    intro: string;
    accent: string;
    accentBg: string;
    gradientFrom: string;
    gradientTo: string;
    icon: typeof BriefcaseBusiness;
    chips: string[];
    steps: string[];
  }
> = {
  CUSTOMER: {
    eyebrow: "Customer Onboarding",
    headline: "Describe the job first. We'll handle the account after.",
    intro:
      "The AI builds a postable brief, confirms it with you, verifies your contact details, then creates your account and publishes the job.",
    accent: "text-sky-700",
    accentBg: "bg-sky-600",
    gradientFrom: "from-sky-500",
    gradientTo: "to-cyan-500",
    icon: BriefcaseBusiness,
    chips: [
      "Kitchen tap leaking since last night",
      "Need a cleaner for a 3-bed home this week",
      "Looking for a painter for two bedrooms in Cork",
    ],
    steps: ["Role", "Job Intake", "Review", "Details", "Verify", "Password"],
  },
  PROFESSIONAL: {
    eyebrow: "Professional Onboarding",
    headline: "Set up a profile before anything else.",
    intro:
      "The AI shapes your trade coverage, service areas, and profile. Once contact details are verified, your account is live and ready for jobs.",
    accent: "text-emerald-700",
    accentBg: "bg-emerald-600",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-500",
    icon: Wrench,
    chips: [
      "Plumber covering Dublin west and Kildare",
      "Electrician with 9 years domestic experience",
      "Cleaner covering Galway city and nearby areas",
    ],
    steps: ["Role", "Profile", "Review", "Details", "Verify", "Password"],
  },
};

function parseRoleParam(search: string): OnboardingRole | null {
  const params = new URLSearchParams(search);
  const value = params.get("role");
  if (value === "CUSTOMER" || value === "PROFESSIONAL") return value;
  return null;
}

function getCategoryParam(search: string): string | null {
  return new URLSearchParams(search).get("category");
}

function mapStepIndex(session: OnboardingSessionState | null): number {
  if (!session) return 0;
  switch (session.currentStep) {
    case "JOB_INTAKE":
    case "PROFILE_INTAKE":
      return 1;
    case "JOB_REVIEW":
    case "PROFILE_REVIEW":
      return 2;
    case "PERSONAL_DETAILS":
    case "PERSONAL_REVIEW":
      return 3;
    case "PHONE_OTP":
    case "EMAIL_OTP":
      return 4;
    case "PASSWORD":
    case "COMPLETE":
      return 5;
    default:
      return 0;
  }
}

function maskTarget(target: string | undefined, channel: "EMAIL" | "PHONE") {
  if (!target) return "";
  if (channel === "EMAIL") {
    const [name, domain] = target.split("@");
    if (!name || !domain) return target;
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const t = target.replace(/\s+/g, "");
  return `${t.slice(0, 3)}***${t.slice(-2)}`;
}

function calcPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Too weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "bg-orange-400" };
  if (score === 3) return { score, label: "Fair", color: "bg-yellow-400" };
  if (score === 4) return { score, label: "Good", color: "bg-emerald-400" };
  return { score, label: "Strong", color: "bg-emerald-600" };
}

async function requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || "Request failed");
  return payload as T;
}

// ── Role selector ──────────────────────────────────────────────────────────

function RoleSelector({ onChoose }: { onChoose: (role: OnboardingRole) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">How are you using ServiceConnect?</h2>
        <p className="mt-2 text-sm text-slate-500">Choose your path — the experience adapts from here.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["CUSTOMER", "PROFESSIONAL"] as OnboardingRole[]).map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <button
              key={role}
              type="button"
              onClick={() => onChoose(role)}
              className="group relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-7 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-xl"
            >
              <div
                className={cn(
                  "mb-5 inline-flex rounded-2xl p-3 bg-gradient-to-br",
                  meta.gradientFrom,
                  meta.gradientTo,
                )}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {meta.eyebrow}
              </p>
              <h3 className="mb-3 text-xl font-bold tracking-tight text-slate-950">
                {role === "CUSTOMER" ? "I need help with a job" : "I'm joining as a professional"}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-slate-500">{meta.intro}</p>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:gap-2.5 transition-all">
                Start here <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-700 underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RoleAwareOnboarding({ initialRole }: { initialRole?: OnboardingRole }) {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const { data: categories = [] } = useQuery<CategoryRecord[]>({ queryKey: ["/api/categories"] });

  const [session, setSession] = useState<OnboardingSessionState | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [customerDraft, setCustomerDraft] = useState<CustomerJobDraft | null>(null);
  const [professionalDraft, setProfessionalDraft] = useState<ProfessionalProfileDraft | null>(null);
  const [personalDraft, setPersonalDraft] = useState<Partial<PersonalDetails>>({});
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [otpChallengeByChannel, setOtpChallengeByChannel] = useState<Record<"EMAIL" | "PHONE", VerificationChallengeFeedback | null>>({
    EMAIL: null,
    PHONE: null,
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [completionState, setCompletionState] = useState<OnboardingCompletionResult | null>(null);

  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const autoSeededCategoryForSession = useRef<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const roleParam = useMemo(() => initialRole ?? parseRoleParam(search), [initialRole, search]);
  const categoryParam = useMemo(() => getCategoryParam(search), [search]);

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.transcript.length, busyAction]);

  useEffect(() => {
    if (session) {
      setCustomerDraft(session.payload.customerJob);
      setProfessionalDraft(session.payload.professionalProfile);
      setPersonalDraft(session.payload.personalDetails ?? {});
    }
  }, [session]);

  // Reset OTP when entering an OTP step
  useEffect(() => {
    if (session?.currentStep === "PHONE_OTP" || session?.currentStep === "EMAIL_OTP") {
      setOtpDigits(Array(6).fill(""));
      const activeChannel = session.currentStep === "PHONE_OTP" ? "PHONE" : "EMAIL";
      setOtpChallengeByChannel((prev) => ({ ...prev, [activeChannel]: null }));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [session?.currentStep]);

  const navigateForRole = useCallback(
    (role: OnboardingRole) => {
      const params = new URLSearchParams();
      if (role === "CUSTOMER" && categoryParam) {
        params.set("category", categoryParam);
      }
      setLocation(buildOnboardingPath(role, params.toString()));
    },
    [categoryParam, setLocation],
  );

  const loadSession = useCallback(async (sessionId: string) => {
    const next = await requestJson<OnboardingSessionState>("GET", `/api/onboarding/sessions/${sessionId}`);
    if (next.status !== "ACTIVE") {
      clearStoredOnboardingSessionId();
      return null;
    }
    storeOnboardingSessionId(next.id);
    setSession(next);
    return next;
  }, []);

  const createSession = useCallback(async (role: OnboardingRole, previousSessionId?: string) => {
    const next = await requestJson<OnboardingSessionState>("POST", "/api/onboarding/sessions", {
      role,
      previousSessionId,
    });
    storeOnboardingSessionId(next.id);
    setSession(next);
    return next;
  }, []);

  // Redirect already-logged-in users
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (authLoading) return;
      if (user) {
        if (user.role === "PROFESSIONAL") setLocation("/pro/dashboard");
        else if (user.role === "ADMIN") setLocation("/admin");
        else setLocation("/dashboard");
        return;
      }
      const storedId = getStoredOnboardingSessionId();
      if (!storedId) { setBootstrapping(false); return; }
      try {
        const restored = await loadSession(storedId);
        if (cancelled || !restored) return;
      } catch {
        clearStoredOnboardingSessionId();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, [authLoading, loadSession, setLocation, user]);

  // Ensure session for URL role param
  useEffect(() => {
    if (bootstrapping || authLoading || user) return;
    if (!roleParam) return;
    const nextRole: OnboardingRole = roleParam;
    if (session?.role === nextRole && session.status === "ACTIVE") return;
    let cancelled = false;
    async function ensureRoleSession() {
      try {
        setBusyAction("bootstrap");
        const previousSessionId = session?.id ?? getStoredOnboardingSessionId() ?? undefined;
        const nextSession = await createSession(nextRole, previousSessionId);
        if (cancelled) return;
        setSession(nextSession);
      } catch (error) {
        toast({
          title: "Unable to start onboarding",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setBusyAction(null);
      }
    }
    ensureRoleSession();
    return () => { cancelled = true; };
  }, [authLoading, bootstrapping, createSession, roleParam, session?.id, session?.role, session?.status, toast, user]);

  const patchSession = useCallback(
    async (body: Record<string, unknown>, actionKey: string) => {
      if (!session) return null;
      setBusyAction(actionKey);
      try {
        const next = await requestJson<OnboardingSessionState>(
          "PATCH",
          `/api/onboarding/sessions/${session.id}`,
          body,
        );
        setSession(next);
        return next;
      } finally {
        setBusyAction(null);
      }
    },
    [session],
  );

  // Seed category from URL param
  useEffect(() => {
    if (!session || session.role !== "CUSTOMER" || !categoryParam || categories.length === 0) return;
    if (session.payload.customerJob?.categoryId) return;
    if (autoSeededCategoryForSession.current === session.id) return;
    const matched = categories.find((c) => c.id === categoryParam);
    autoSeededCategoryForSession.current = session.id;
    if (!matched) return;
    void patchSession({ customerJob: { categoryId: matched.id, categoryLabel: matched.name } }, "seed-category");
  }, [categories, categoryParam, patchSession, session]);

  // Auto-send OTP when entering OTP steps
  useEffect(() => {
    if (!session) return;
    if (session.currentStep !== "PHONE_OTP" && session.currentStep !== "EMAIL_OTP") return;
    const channel = session.currentStep === "PHONE_OTP" ? "PHONE" : "EMAIL";
    const lastSentAt =
      channel === "PHONE" ? session.verificationState.phoneLastSentAt : session.verificationState.emailLastSentAt;
    if (lastSentAt) return;
    void (async () => {
      try {
        setBusyAction(`send-${channel.toLowerCase()}`);
        const payload = await requestJson<{ session: OnboardingSessionState; challenge: VerificationChallengeFeedback }>(
          "POST",
          `/api/onboarding/sessions/${session.id}/otp/send`,
          { channel },
        );
        setSession(payload.session);
        setOtpChallengeByChannel((prev) => ({ ...prev, [channel]: payload.challenge ?? null }));
        toast({
          title: `${channel === "PHONE" ? "Phone" : "Email"} code sent`,
          description:
            payload.challenge?.deliveryMode === "DEV_FALLBACK" && payload.challenge.fallbackCode
              ? `Provider fallback is active locally. Use ${payload.challenge.fallbackCode}.`
              : `Sent to ${payload.challenge?.maskedTarget ?? maskTarget(otpTarget, channel)}.`,
        });
      } catch (error) {
        toast({
          title: "Unable to send code",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setBusyAction(null);
      }
    })();
  }, [session, toast]);

  // ── Action handlers ──────────────────────────────────────────────────────

  const submitChat = async () => {
    if (!session || !chatMessage.trim()) return;
    setBusyAction("chat");
    try {
      const next = await requestJson<OnboardingSessionState>(
        "POST",
        `/api/onboarding/sessions/${session.id}/chat`,
        { message: chatMessage.trim() },
      );
      setSession(next);
      setChatMessage("");
    } catch (error) {
      toast({
        title: "Message failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitChat();
    }
  };

  const saveCustomerReview = async () => {
    if (!customerDraft) return;
    await patchSession({ customerJob: customerDraft }, "save-job");
  };

  const saveProfessionalReview = async () => {
    if (!professionalDraft) return;
    await patchSession({ professionalProfile: professionalDraft }, "save-profile");
  };

  const savePersonalDetails = async () => {
    const details = {
      firstName: personalDraft.firstName?.trim() ?? "",
      lastName: personalDraft.lastName?.trim() ?? "",
      email: personalDraft.email?.trim() ?? "",
      phone: personalDraft.phone?.trim() ?? "",
    };
    if (!details.firstName || !details.lastName) {
      toast({ title: "Name is required", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(details.email)) {
      toast({ title: "Valid email required", description: "Please correct your email address.", variant: "destructive" });
      return;
    }
    if (details.phone.replace(/\D/g, "").length < 7) {
      toast({ title: "Valid phone required", description: "Please correct your phone number.", variant: "destructive" });
      return;
    }
    await patchSession({ personalDetails: details }, "save-personal");
  };

  const confirmIntakeReview = async () => {
    const next = await patchSession({ action: "CONFIRM_INTAKE_REVIEW" }, "confirm-intake");
    if (next?.currentStep === "PERSONAL_DETAILS") {
      toast({ title: "Summary locked in", description: "Now enter your contact details." });
    }
  };

  const confirmPersonalReview = async () => {
    const next = await patchSession({ action: "CONFIRM_PERSONAL_REVIEW" }, "confirm-personal");
    if (next?.currentStep === "PHONE_OTP") {
      setOtpDigits(Array(6).fill(""));
    }
  };

  const sendOtp = async (channel: "EMAIL" | "PHONE") => {
    if (!session) return;
    setBusyAction(`send-${channel.toLowerCase()}`);
    try {
      const payload = await requestJson<{ session: OnboardingSessionState; challenge: VerificationChallengeFeedback }>(
        "POST",
        `/api/onboarding/sessions/${session.id}/otp/send`,
        { channel },
      );
      setSession(payload.session);
      setOtpChallengeByChannel((prev) => ({ ...prev, [channel]: payload.challenge ?? null }));
      toast({
        title: "Code resent",
        description:
          payload.challenge?.deliveryMode === "DEV_FALLBACK" && payload.challenge.fallbackCode
            ? `Provider fallback is active locally. Use ${payload.challenge.fallbackCode}.`
            : `Sent to ${payload.challenge?.maskedTarget ?? maskTarget(otpTarget, channel)}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to resend code",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const verifyOtp = async (channel: "EMAIL" | "PHONE") => {
    if (!session) return;
    const code = otpDigits.join("");
    if (code.length !== 6) {
      toast({ title: "Enter the full code", description: "Use the 6-digit verification code.", variant: "destructive" });
      return;
    }
    setBusyAction(`verify-${channel.toLowerCase()}`);
    try {
      const payload = await requestJson<{ session: OnboardingSessionState }>(
        "POST",
        `/api/onboarding/sessions/${session.id}/otp/verify`,
        { channel, code },
      );
      setSession(payload.session);
      setOtpDigits(Array(6).fill(""));
      toast({
        title: `${channel === "PHONE" ? "Phone" : "Email"} verified`,
        description: channel === "PHONE" ? "Now confirm your email address." : "Both verified — set your password.",
      });
    } catch (error) {
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const completeOnboarding = async () => {
    if (!session) return;
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      toast({
        title: "Password is too weak",
        description: "Use at least 8 characters with a letter and a number.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both fields match.", variant: "destructive" });
      return;
    }
    setBusyAction("complete");
    try {
      const result = await requestJson<OnboardingCompletionResult>(
        "POST",
        `/api/onboarding/sessions/${session.id}/complete`,
        { password },
      );
      setTokens(result.accessToken, result.refreshToken);
      await refreshUser();
      clearStoredOnboardingSessionId();
      setCompletionState(result);
      setPassword("");
      setConfirmPassword("");
      toast({ title: "Account created", description: result.nextPrompt || "Taking you to your dashboard." });
      window.setTimeout(() => setLocation(result.redirectTo), 1400);
    } catch (error) {
      toast({
        title: "Account setup failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  // ── OTP digit box handlers ───────────────────────────────────────────────

  const handleOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = "";
        setOtpDigits(next);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
    setOtpDigits(next);
    const lastFilled = Math.min(pasted.length, 5);
    otpRefs.current[lastFilled]?.focus();
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const activeRole = session?.role ?? roleParam;
  const roleMeta = activeRole ? ROLE_META[activeRole] : null;
  const ActiveRoleIcon = roleMeta?.icon;
  const progressIndex = mapStepIndex(session);
  const progressPct = roleMeta ? (progressIndex / (roleMeta.steps.length - 1)) * 100 : 0;
  const channelForOtp = session?.currentStep === "PHONE_OTP" ? "PHONE" : "EMAIL";
  const otpTarget =
    session?.currentStep === "PHONE_OTP"
      ? session.payload.personalDetails.phone
      : session?.payload.personalDetails.email;
  const currentOtpChallenge = otpChallengeByChannel[channelForOtp];
  const otpCode = otpDigits.join("");
  const pwStrength = calcPasswordStrength(password);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderChatIntake = () => (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
        <p className="text-sm leading-relaxed text-slate-600">
          {session?.role === "CUSTOMER"
            ? "Start with the problem — what needs doing, roughly where, and how urgent it feels."
            : "Tell me about your trade, where you cover, what kind of jobs you want, and anything that builds trust."}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">ServiceConnect AI</p>
            <p className="text-xs text-slate-400">Role-aware intake · live validation</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-400">Online</span>
          </div>
        </div>

        {/* Transcript */}
        <ScrollArea className="h-80 px-5 py-4">
          <div className="space-y-4">
            {session?.transcript.map((entry, i) => (
              <div
                key={`${entry.createdAt}-${i}`}
                className={cn("flex gap-3", entry.role === "user" ? "justify-end" : "justify-start")}
              >
                {entry.role !== "user" && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                    entry.role === "user"
                      ? "rounded-tr-sm bg-slate-950 text-white"
                      : "rounded-tl-sm border border-slate-100 bg-slate-50 text-slate-700",
                  )}
                >
                  {entry.content}
                </div>
                {entry.role === "user" && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                    <UserRound className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {busyAction === "chat" && (
              <div className="flex justify-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1 rounded-3xl rounded-tl-sm border border-slate-100 bg-slate-50 px-4 py-3">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={transcriptBottomRef} />
          </div>
        </ScrollArea>

        {/* Suggestion chips */}
        <div className="border-t border-slate-100 px-5 pt-4">
          <div className="flex flex-wrap gap-2 pb-3">
            {roleMeta?.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setChatMessage(chip)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Input row */}
        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <Textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={handleChatKeyDown}
            rows={2}
            placeholder={
              session?.role === "CUSTOMER"
                ? "Describe the job... (Enter to send)"
                : "Describe your trade and coverage... (Enter to send)"
            }
            className="min-h-[52px] flex-1 resize-none rounded-2xl border-slate-200 text-sm"
          />
          <Button
            className="self-end rounded-2xl"
            onClick={submitChat}
            disabled={busyAction === "chat" || !chatMessage.trim()}
          >
            {busyAction === "chat" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStructuredSummary = () => {
    if (!session) return null;

    if (session.role === "CUSTOMER" && customerDraft) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-slate-950">Review your job details</h3>
            <p className="mt-1 text-sm text-slate-500">Edit anything before we move to your contact details.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job title</Label>
              <Input
                value={customerDraft.title}
                onChange={(e) => setCustomerDraft({ ...customerDraft, title: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</Label>
              <Textarea
                value={customerDraft.description}
                onChange={(e) => setCustomerDraft({ ...customerDraft, description: e.target.value })}
                rows={5}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</Label>
              <select
                value={customerDraft.categoryId}
                onChange={(e) => {
                  const match = categories.find((c) => c.id === e.target.value);
                  setCustomerDraft({ ...customerDraft, categoryId: e.target.value, categoryLabel: match?.name || "" });
                }}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Urgency</Label>
              <select
                value={customerDraft.urgency}
                onChange={(e) =>
                  setCustomerDraft({ ...customerDraft, urgency: e.target.value as CustomerJobDraft["urgency"] })
                }
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</Label>
              <Input
                value={customerDraft.locationText}
                onChange={(e) => setCustomerDraft({ ...customerDraft, locationText: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred date</Label>
              <Input
                value={customerDraft.preferredDate ?? ""}
                onChange={(e) => setCustomerDraft({ ...customerDraft, preferredDate: e.target.value || null })}
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget min (€)</Label>
              <Input
                value={customerDraft.budgetMin ?? ""}
                onChange={(e) => setCustomerDraft({ ...customerDraft, budgetMin: e.target.value || null })}
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget max (€)</Label>
              <Input
                value={customerDraft.budgetMax ?? ""}
                onChange={(e) => setCustomerDraft({ ...customerDraft, budgetMax: e.target.value || null })}
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
          </div>

          {customerDraft.aiQualityScore !== null && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="font-medium text-slate-900">AI quality score:</span>
              <span
                className={cn(
                  "font-semibold",
                  (customerDraft.aiQualityScore ?? 0) >= 60 ? "text-emerald-700" : "text-amber-600",
                )}
              >
                {customerDraft.aiQualityScore} / 100
              </span>
              {customerDraft.completionIssues.length > 0 && (
                <span className="text-slate-500">{customerDraft.completionIssues.join(" · ")}</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={saveCustomerReview} disabled={busyAction === "save-job"} className="rounded-xl">
              {busyAction === "save-job" ? "Saving..." : "Save changes"}
            </Button>
            {session.currentStep === "JOB_REVIEW" && (
              <Button onClick={confirmIntakeReview} disabled={busyAction === "confirm-intake"} className="rounded-xl">
                {busyAction === "confirm-intake" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue to personal details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (professionalDraft) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-slate-950">Review your professional profile</h3>
            <p className="mt-1 text-sm text-slate-500">Make any edits before continuing.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service categories</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const selected = professionalDraft.categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setProfessionalDraft({
                        ...professionalDraft,
                        categoryIds: selected
                          ? professionalDraft.categoryIds.filter((id) => id !== cat.id)
                          : [...professionalDraft.categoryIds, cat.id],
                        categoryLabels: selected
                          ? professionalDraft.categoryLabels.filter((l) => l !== cat.name)
                          : [...professionalDraft.categoryLabels, cat.name],
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      selected
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Base location</Label>
              <Input
                value={professionalDraft.location}
                onChange={(e) => setProfessionalDraft({ ...professionalDraft, location: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service radius (km)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={professionalDraft.serviceRadius ?? 25}
                onChange={(e) =>
                  setProfessionalDraft({ ...professionalDraft, serviceRadius: Number(e.target.value || 25) })
                }
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Years experience</Label>
              <Input
                type="number"
                min={0}
                max={80}
                value={professionalDraft.yearsExperience ?? ""}
                onChange={(e) =>
                  setProfessionalDraft({
                    ...professionalDraft,
                    yearsExperience: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business name</Label>
              <Input
                value={professionalDraft.businessName ?? ""}
                onChange={(e) =>
                  setProfessionalDraft({ ...professionalDraft, businessName: e.target.value || null })
                }
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">About your work</Label>
              <Textarea
                value={professionalDraft.bio}
                onChange={(e) => setProfessionalDraft({ ...professionalDraft, bio: e.target.value })}
                rows={5}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Credentials / trust notes{" "}
                <span className="ml-1 text-slate-400 font-normal normal-case">(optional)</span>
              </Label>
              <Textarea
                value={professionalDraft.credentials ?? ""}
                onChange={(e) =>
                  setProfessionalDraft({ ...professionalDraft, credentials: e.target.value || null })
                }
                rows={3}
                placeholder="Certifications, insurance, trade body membership…"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={saveProfessionalReview} disabled={busyAction === "save-profile"} className="rounded-xl">
              {busyAction === "save-profile" ? "Saving..." : "Save changes"}
            </Button>
            {session.currentStep === "PROFILE_REVIEW" && (
              <Button onClick={confirmIntakeReview} disabled={busyAction === "confirm-intake"} className="rounded-xl">
                {busyAction === "confirm-intake" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue to personal details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderPersonalForm = (showSummary: boolean) => (
    <div className="space-y-5">
      {showSummary && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">
            {session?.role === "CUSTOMER" ? customerDraft?.title || "Job details captured" : professionalDraft?.bio?.slice(0, 80) || "Profile ready"}
          </p>
          <p className="mt-1 text-slate-500">
            {session?.role === "CUSTOMER"
              ? `${customerDraft?.categoryLabel || "Category pending"} · ${customerDraft?.locationText || "Location pending"}`
              : `${professionalDraft?.categoryLabels.join(", ") || "Trades pending"} · ${professionalDraft?.location || "Coverage pending"}`}
          </p>
        </div>
      )}
      <div>
        <h3 className="font-semibold text-slate-950">Your contact details</h3>
        <p className="mt-1 text-sm text-slate-500">We'll verify both via a short OTP code.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</Label>
          <Input
            value={personalDraft.firstName ?? ""}
            onChange={(e) => setPersonalDraft({ ...personalDraft, firstName: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</Label>
          <Input
            value={personalDraft.lastName ?? ""}
            onChange={(e) => setPersonalDraft({ ...personalDraft, lastName: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</Label>
          <Input
            type="email"
            value={personalDraft.email ?? ""}
            onChange={(e) => setPersonalDraft({ ...personalDraft, email: e.target.value })}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone number</Label>
          <Input
            type="tel"
            value={personalDraft.phone ?? ""}
            onChange={(e) => setPersonalDraft({ ...personalDraft, phone: e.target.value })}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <Button variant="outline" onClick={savePersonalDetails} disabled={busyAction === "save-personal"} className="rounded-xl">
          Save details
        </Button>
        {session?.currentStep === "PERSONAL_DETAILS" && (
          <Button onClick={savePersonalDetails} disabled={busyAction === "save-personal"} className="rounded-xl">
            {busyAction === "save-personal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue to confirmation
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderPersonalReview = () => (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-slate-950">Confirm everything before verification</h3>
        <p className="mt-1 text-sm text-slate-500">
          Once you confirm, we'll send verification codes to your phone and email.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {session?.role === "CUSTOMER" ? "Job summary" : "Professional summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>{renderStructuredSummary()}</CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Personal details</CardTitle>
          </CardHeader>
          <CardContent>{renderPersonalForm(false)}</CardContent>
        </Card>
      </div>
      <Button
        onClick={confirmPersonalReview}
        disabled={busyAction === "confirm-personal"}
        className="rounded-xl"
      >
        {busyAction === "confirm-personal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Confirm and start verification
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
        <div className="mb-4 inline-flex rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
          {channelForOtp === "PHONE" ? <Phone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">
          {channelForOtp === "PHONE" ? "Verify your phone" : "Verify your email"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Enter the 6-digit code sent to{" "}
          <strong className="text-slate-900">{maskTarget(otpTarget, channelForOtp)}</strong>.
        </p>

        {/* Demo hint — clickable */}
        <button
          type="button"
          onClick={() => {
            if (!currentOtpChallenge?.fallbackCode) return;
            setOtpDigits(currentOtpChallenge.fallbackCode.split(""));
            otpRefs.current[5]?.focus();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold tracking-widest text-white transition hover:bg-slate-800"
          title="Click to autofill the demo code"
        >
          {currentOtpChallenge?.fallbackCode ? `Fallback code: ${currentOtpChallenge.fallbackCode}` : "Check your latest code"}
          <span className="text-slate-400">
            {currentOtpChallenge?.fallbackCode ? "(click to fill)" : "(provider delivery active)"}
          </span>
        </button>
      </div>

      {/* 6-digit boxes */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification code</Label>
        <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpDigits[i]}
                onChange={(e) => handleOtpDigit(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className={cn(
                  "h-14 w-12 rounded-2xl border-2 bg-white text-center text-xl font-bold tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2",
                  otpDigits[i]
                    ? "border-slate-950 text-slate-950"
                    : "border-slate-200 text-slate-400",
                )}
              />
            ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => verifyOtp(channelForOtp)}
          disabled={busyAction === `verify-${channelForOtp.toLowerCase()}` || otpCode.length !== 6}
          className="rounded-xl"
        >
          {busyAction === `verify-${channelForOtp.toLowerCase()}` ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Confirm code
        </Button>
        <Button
          variant="outline"
          onClick={() => sendOtp(channelForOtp)}
          disabled={!!busyAction}
          className="rounded-xl gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Resend code
        </Button>
      </div>
    </div>
  );

  const renderPasswordStep = () => {
    const requirements = [
      { met: password.length >= 8, label: "8+ characters" },
      { met: /[A-Za-z]/.test(password), label: "Contains a letter" },
      { met: /\d/.test(password), label: "Contains a number" },
    ];
    const allMet = requirements.every((r) => r.met);
    const matches = password === confirmPassword && confirmPassword.length > 0;

    return (
      <div className="space-y-7">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
          <div className="mb-4 inline-flex rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Set your password</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Both verifications complete. Create a password to finish account setup — you'll be signed in automatically.
          </p>
        </div>

        <div className="space-y-4">
          {/* Password field */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters…"
                className="rounded-xl pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 transition-all duration-300",
                        i < pwStrength.score ? pwStrength.color : "bg-transparent",
                        i > 0 && "ml-0.5",
                      )}
                    />
                  ))}
                </div>
                <p className={cn("text-xs font-medium", pwStrength.score <= 2 ? "text-red-500" : pwStrength.score === 3 ? "text-amber-500" : "text-emerald-600")}>
                  {pwStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm field */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className={cn(
                  "rounded-xl pr-11",
                  confirmPassword.length > 0 && (matches ? "border-emerald-400" : "border-red-400"),
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={cn("text-xs font-medium", matches ? "text-emerald-600" : "text-red-500")}>
                {matches ? "Passwords match" : "Passwords don't match"}
              </p>
            )}
          </div>
        </div>

        {/* Requirements */}
        <div className="grid gap-2 sm:grid-cols-3">
          {requirements.map((r) => (
            <div
              key={r.label}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all",
                r.met ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500",
              )}
            >
              <CheckCircle2 className={cn("h-3.5 w-3.5 flex-shrink-0", r.met ? "text-emerald-600" : "text-slate-300")} />
              {r.label}
            </div>
          ))}
        </div>

        <Button
          onClick={completeOnboarding}
          disabled={busyAction === "complete" || !allMet || !matches}
          className="w-full rounded-xl py-6 text-base font-semibold"
        >
          {busyAction === "complete" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating your account…
            </>
          ) : (
            <>
              Create account and continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    );
  };

  const renderMainStage = () => {
    if (completionState) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-6 text-center">
          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <span className="absolute -right-1 -top-1 flex h-5 w-5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-5 w-5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Account ready!</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {completionState.nextPrompt || "Taking you to your dashboard now."}
            </p>
          </div>
          {completionState.jobStatus && (
            <Badge
              className={cn(
                "px-4 py-1.5 text-sm",
                completionState.jobStatus === "LIVE"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              First job saved as {completionState.jobStatus}
            </Badge>
          )}
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      );
    }

    if (bootstrapping || busyAction === "bootstrap") {
      return (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Restoring your session…</p>
          </div>
        </div>
      );
    }

    if (!roleParam && !session) return <RoleSelector onChoose={navigateForRole} />;

    if (!session) {
      return (
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Preparing your onboarding flow…</p>
          </div>
        </div>
      );
    }

    switch (session.currentStep) {
      case "JOB_INTAKE":
      case "PROFILE_INTAKE":
        return renderChatIntake();
      case "JOB_REVIEW":
      case "PROFILE_REVIEW":
        return renderStructuredSummary();
      case "PERSONAL_DETAILS":
        return renderPersonalForm(true);
      case "PERSONAL_REVIEW":
        return renderPersonalReview();
      case "PHONE_OTP":
      case "EMAIL_OTP":
        return renderOtpStep();
      case "PASSWORD":
        return renderPasswordStep();
      default:
        return null;
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight text-slate-950">ServiceConnect</span>
          </Link>
          {!user && (
            <p className="text-sm text-slate-500">
              Have an account?{" "}
              <Link href="/login" className="font-medium text-slate-950 underline-offset-2 hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          {/* ── Left sidebar ── */}
          <aside className="space-y-5">
            {/* Hero card */}
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl border border-white/70 p-7 shadow-xl",
                roleMeta
                  ? `bg-gradient-to-br ${roleMeta.gradientFrom}/10 ${roleMeta.gradientTo}/5 to-white`
                  : "bg-white",
              )}
            >
              <div className="mb-5 flex items-center gap-3">
                {ActiveRoleIcon && (
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br shadow",
                      roleMeta?.gradientFrom,
                      roleMeta?.gradientTo,
                    )}
                  >
                    <ActiveRoleIcon className="h-5 w-5 text-white" />
                  </div>
                )}
                {roleMeta && (
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {roleMeta.eyebrow}
                  </p>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                {roleMeta?.headline || "Join ServiceConnect"}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                {roleMeta?.intro || "Choose your role and the flow adapts from here."}
              </p>

              {/* Role switch pills */}
              <div className="mt-5 flex flex-wrap gap-2">
                {(["CUSTOMER", "PROFESSIONAL"] as OnboardingRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => navigateForRole(role)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition",
                      activeRole === role
                        ? "bg-slate-950 text-white shadow"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                    )}
                  >
                    {role === "CUSTOMER" ? "Customer" : "Professional"}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress tracker */}
            {roleMeta && (
              <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wide">Progress</span>
                  <span>
                    {progressIndex}/{roleMeta.steps.length - 1}
                  </span>
                </div>
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-950 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {roleMeta.steps.map((step, i) => {
                    const done = i < progressIndex;
                    const active = i === progressIndex;
                    return (
                      <div
                        key={step}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                          active ? "bg-slate-950 text-white shadow" : done ? "bg-emerald-50 text-emerald-700" : "text-slate-400",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            active ? "bg-white/20 text-white" : done ? "bg-emerald-200 text-emerald-700" : "bg-slate-100",
                          )}
                        >
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === 0 ? <Sparkles className="h-3 w-3" /> : i}
                        </div>
                        <span className={cn("font-medium", active && "font-semibold")}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live snapshot */}
            {session && (
              <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Live snapshot
                </p>
                <div className="space-y-3 text-sm">
                  {session.role === "CUSTOMER" && customerDraft && (
                    <>
                      <div className="flex items-start gap-2.5">
                        <MessageSquareText className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-950">
                            {customerDraft.title || "Job in progress"}
                          </p>
                          <p className="text-slate-400">
                            {customerDraft.categoryLabel || "Category pending"} ·{" "}
                            {customerDraft.locationText || "Location pending"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Urgency: {customerDraft.urgency}
                      </Badge>
                    </>
                  )}
                  {session.role === "PROFESSIONAL" && professionalDraft && (
                    <>
                      <div className="flex items-start gap-2.5">
                        <Wrench className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-950">
                            {professionalDraft.categoryLabels.join(", ") || "Trade in progress"}
                          </p>
                          <p className="text-slate-400">{professionalDraft.location || "Coverage pending"}</p>
                        </div>
                      </div>
                      {professionalDraft.bio && (
                        <p className="line-clamp-2 text-xs text-slate-400">{professionalDraft.bio}</p>
                      )}
                    </>
                  )}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-slate-600">
                      <UserRound className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Contact</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {personalDraft.firstName
                        ? `${personalDraft.firstName} ${personalDraft.lastName || ""}`.trim()
                        : "Name pending"}
                    </p>
                    <p className="text-xs text-slate-400">{personalDraft.email || "Email pending"}</p>
                    <p className="text-xs text-slate-400">{personalDraft.phone || "Phone pending"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["PHONE", "EMAIL"] as const).map((ch) => {
                      const verified =
                        ch === "PHONE"
                          ? session.verificationState.phoneVerified
                          : session.verificationState.emailVerified;
                      return (
                        <div
                          key={ch}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border p-2.5 text-xs",
                            verified
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-100 bg-slate-50 text-slate-400",
                          )}
                        >
                          {ch === "PHONE" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                          <span className="font-medium">{ch === "PHONE" ? "Phone" : "Email"}</span>
                          <span className="ml-auto">{verified ? "✓" : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* ── Main content ── */}
          <main>
            <div className="min-h-[640px] rounded-3xl border border-white/70 bg-white p-6 shadow-xl sm:p-8">
              {renderMainStage()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
