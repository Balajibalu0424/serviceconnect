import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Phone,
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
import { DEMO_OTP_CODE } from "@shared/verification";
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

const ROLE_META: Record<OnboardingRole, {
  eyebrow: string;
  headline: string;
  intro: string;
  accent: string;
  accentSoft: string;
  icon: typeof BriefcaseBusiness;
  chips: string[];
  steps: string[];
}> = {
  CUSTOMER: {
    eyebrow: "Customer Onboarding",
    headline: "Describe the job first. We will take care of the account after.",
    intro: "The assistant builds a postable job brief, confirms it with you, verifies your contact details, then creates your account and publishes the job when it is ready.",
    accent: "text-sky-700",
    accentSoft: "from-sky-500/20 via-cyan-500/10 to-white",
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
    headline: "Set up a usable profile before we ask for anything else.",
    intro: "The assistant helps shape your trade coverage, service areas, and profile strength. Once your contact details are verified, your account is created ready for live jobs.",
    accent: "text-emerald-700",
    accentSoft: "from-emerald-500/20 via-amber-500/10 to-white",
    icon: Wrench,
    chips: [
      "I am a plumber covering Dublin west and Kildare",
      "Electrician with 9 years experience in domestic work",
      "Cleaner covering Galway city and nearby areas",
    ],
    steps: ["Role", "Profile", "Review", "Details", "Verify", "Password"],
  },
};

function parseRoleParam(search: string): OnboardingRole | null {
  const params = new URLSearchParams(search);
  const value = params.get("role");
  if (value === "CUSTOMER" || value === "PROFESSIONAL") {
    return value;
  }
  return null;
}

function getCategoryParam(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get("category");
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
  const trimmed = target.replace(/\s+/g, "");
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

async function requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Request failed");
  }

  return payload as T;
}

function RoleSelector({
  onChoose,
}: {
  onChoose: (role: OnboardingRole) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["CUSTOMER", "PROFESSIONAL"] as OnboardingRole[]).map((role) => {
        const meta = ROLE_META[role];
        const Icon = meta.icon;

        return (
          <button
            key={role}
            type="button"
            onClick={() => onChoose(role)}
            className="rounded-[28px] border border-white/60 bg-white/85 p-7 text-left shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            <div className={cn("mb-5 inline-flex rounded-2xl bg-gradient-to-br p-3", role === "CUSTOMER" ? "from-sky-500 to-cyan-500" : "from-emerald-500 to-amber-500")}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{meta.eyebrow}</p>
            <h2 className="mb-3 text-2xl font-semibold tracking-tight text-slate-950">{role === "CUSTOMER" ? "I need help with a job" : "I am joining as a professional"}</h2>
            <p className="mb-5 text-sm leading-6 text-slate-600">{meta.intro}</p>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              Start onboarding
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function RoleAwareOnboarding() {
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
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [completionState, setCompletionState] = useState<OnboardingCompletionResult | null>(null);

  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const autoSeededCategoryForSession = useRef<string | null>(null);

  const roleParam = useMemo(() => parseRoleParam(search), [search]);
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

  const navigateForRole = useCallback((role: OnboardingRole) => {
    const params = new URLSearchParams();
    params.set("role", role);
    if (role === "CUSTOMER" && categoryParam) {
      params.set("category", categoryParam);
    }
    setLocation(`/register?${params.toString()}`);
  }, [categoryParam, setLocation]);

  const loadSession = useCallback(async (sessionId: string) => {
    const nextSession = await requestJson<OnboardingSessionState>("GET", `/api/onboarding/sessions/${sessionId}`);
    if (nextSession.status !== "ACTIVE") {
      clearStoredOnboardingSessionId();
      return null;
    }
    storeOnboardingSessionId(nextSession.id);
    setSession(nextSession);
    return nextSession;
  }, []);

  const createSession = useCallback(async (role: OnboardingRole, previousSessionId?: string) => {
    const nextSession = await requestJson<OnboardingSessionState>("POST", "/api/onboarding/sessions", {
      role,
      previousSessionId,
    });
    storeOnboardingSessionId(nextSession.id);
    setSession(nextSession);
    return nextSession;
  }, []);

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
      if (!storedId) {
        setBootstrapping(false);
        return;
      }

      try {
        const restored = await loadSession(storedId);
        if (cancelled || !restored) return;
      } catch {
        clearStoredOnboardingSessionId();
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [authLoading, loadSession, setLocation, user]);

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
        if (!cancelled) {
          setBusyAction(null);
        }
      }
    }

    ensureRoleSession();

    return () => {
      cancelled = true;
    };
  }, [authLoading, bootstrapping, createSession, roleParam, session?.id, session?.role, session?.status, toast, user]);

  const patchSession = useCallback(async (body: Record<string, unknown>, actionKey: string) => {
    if (!session) return null;
    setBusyAction(actionKey);
    try {
      const nextSession = await requestJson<OnboardingSessionState>("PATCH", `/api/onboarding/sessions/${session.id}`, body);
      setSession(nextSession);
      return nextSession;
    } finally {
      setBusyAction(null);
    }
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== "CUSTOMER" || !categoryParam || categories.length === 0) return;
    if (session.payload.customerJob?.categoryId) return;
    if (autoSeededCategoryForSession.current === session.id) return;

    const matched = categories.find((category) => category.id === categoryParam);
    autoSeededCategoryForSession.current = session.id;

    if (!matched) return;

    void patchSession({
      customerJob: {
        categoryId: matched.id,
        categoryLabel: matched.name,
      },
    }, "seed-category");
  }, [categories, categoryParam, patchSession, session]);

  useEffect(() => {
    if (!session) return;
    if (session.currentStep !== "PHONE_OTP" && session.currentStep !== "EMAIL_OTP") return;

    const channel = session.currentStep === "PHONE_OTP" ? "PHONE" : "EMAIL";
    const lastSentAt = channel === "PHONE"
      ? session.verificationState.phoneLastSentAt
      : session.verificationState.emailLastSentAt;

    if (lastSentAt) return;

    void (async () => {
      try {
        setBusyAction(`send-${channel.toLowerCase()}`);
        const payload = await requestJson<{ session: OnboardingSessionState }>(
          "POST",
          `/api/onboarding/sessions/${session.id}/otp/send`,
          { channel },
        );
        setSession(payload.session);
        toast({
          title: `${channel === "PHONE" ? "Phone" : "Email"} code sent`,
          description: `Demo mode is active. Use ${DEMO_OTP_CODE} to continue.`,
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

  const submitChat = async () => {
    if (!session || !chatMessage.trim()) return;
    setBusyAction("chat");
    try {
      const nextSession = await requestJson<OnboardingSessionState>(
        "POST",
        `/api/onboarding/sessions/${session.id}/chat`,
        { message: chatMessage.trim() },
      );
      setSession(nextSession);
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
    const nextSession = await patchSession({ action: "CONFIRM_INTAKE_REVIEW" }, "confirm-intake");
    if (nextSession?.currentStep === "PERSONAL_DETAILS") {
      toast({ title: "Summary locked in", description: "Now confirm your contact details." });
    }
  };

  const confirmPersonalReview = async () => {
    const nextSession = await patchSession({ action: "CONFIRM_PERSONAL_REVIEW" }, "confirm-personal");
    if (nextSession?.currentStep === "PHONE_OTP") {
      setOtpCode("");
    }
  };

  const sendOtp = async (channel: "EMAIL" | "PHONE") => {
    if (!session) return;
    setBusyAction(`send-${channel.toLowerCase()}`);
    try {
      const payload = await requestJson<{ session: OnboardingSessionState }>(
        "POST",
        `/api/onboarding/sessions/${session.id}/otp/send`,
        { channel },
      );
      setSession(payload.session);
      toast({
        title: "Verification code sent",
        description: `Demo mode is active. Use ${DEMO_OTP_CODE}.`,
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
    if (otpCode.trim().length !== 6) {
      toast({ title: "Enter the full code", description: "Use the 6-digit verification code.", variant: "destructive" });
      return;
    }

    setBusyAction(`verify-${channel.toLowerCase()}`);
    try {
      const payload = await requestJson<{ session: OnboardingSessionState }>(
        "POST",
        `/api/onboarding/sessions/${session.id}/otp/verify`,
        { channel, code: otpCode.trim() },
      );
      setSession(payload.session);
      setOtpCode("");
      toast({
        title: `${channel === "PHONE" ? "Phone" : "Email"} verified`,
        description: channel === "PHONE" ? "Now confirm your email." : "Your account is ready for a password.",
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
        description: "Use at least 8 characters with at least one letter and one number.",
        variant: "destructive",
      });
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
      toast({
        title: "Account created",
        description: result.nextPrompt || "Taking you to your dashboard.",
      });
      window.setTimeout(() => {
        setLocation(result.redirectTo);
      }, 1400);
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

  const activeRole = session?.role ?? roleParam;
  const roleMeta = activeRole ? ROLE_META[activeRole] : null;
  const ActiveRoleIcon = roleMeta?.icon;
  const progressIndex = mapStepIndex(session);
  const progressWidth = roleMeta ? `${(progressIndex / (roleMeta.steps.length - 1)) * 100}%` : "0%";
  const channelForOtp = session?.currentStep === "PHONE_OTP" ? "PHONE" : "EMAIL";
  const otpTarget = session?.currentStep === "PHONE_OTP"
    ? session.payload.personalDetails.phone
    : session?.payload.personalDetails.email;

  const renderStructuredSummary = () => {
    if (!session) return null;

    if (session.role === "CUSTOMER" && customerDraft) {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Job title</Label>
              <Input value={customerDraft.title} onChange={(event) => setCustomerDraft({ ...customerDraft, title: event.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={customerDraft.description} onChange={(event) => setCustomerDraft({ ...customerDraft, description: event.target.value })} rows={6} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={customerDraft.categoryId}
                onChange={(event) => {
                  const matched = categories.find((category) => category.id === event.target.value);
                  setCustomerDraft({ ...customerDraft, categoryId: event.target.value, categoryLabel: matched?.name || "" });
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <select
                value={customerDraft.urgency}
                onChange={(event) => setCustomerDraft({ ...customerDraft, urgency: event.target.value as CustomerJobDraft["urgency"] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={customerDraft.locationText} onChange={(event) => setCustomerDraft({ ...customerDraft, locationText: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preferred date</Label>
              <Input value={customerDraft.preferredDate ?? ""} onChange={(event) => setCustomerDraft({ ...customerDraft, preferredDate: event.target.value || null })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Budget min</Label>
              <Input value={customerDraft.budgetMin ?? ""} onChange={(event) => setCustomerDraft({ ...customerDraft, budgetMin: event.target.value || null })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Budget max</Label>
              <Input value={customerDraft.budgetMax ?? ""} onChange={(event) => setCustomerDraft({ ...customerDraft, budgetMax: event.target.value || null })} placeholder="Optional" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">AI quality:</span>
            <span>{customerDraft.aiQualityScore ?? "Pending"} / 100</span>
            {customerDraft.completionIssues.length > 0 && <span>{customerDraft.completionIssues.join(" · ")}</span>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={saveCustomerReview} disabled={busyAction === "save-job"}>{busyAction === "save-job" ? "Saving..." : "Save changes"}</Button>
            {session.currentStep === "JOB_REVIEW" && <Button onClick={confirmIntakeReview} disabled={busyAction === "confirm-intake"}>Continue to personal details</Button>}
          </div>
        </div>
      );
    }

    if (professionalDraft) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Service categories</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isSelected = professionalDraft.categoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setProfessionalDraft({
                        ...professionalDraft,
                        categoryIds: isSelected ? professionalDraft.categoryIds.filter((id) => id !== category.id) : [...professionalDraft.categoryIds, category.id],
                        categoryLabels: isSelected ? professionalDraft.categoryLabels.filter((label) => label !== category.name) : [...professionalDraft.categoryLabels, category.name],
                      });
                    }}
                    className={cn("rounded-full border px-3 py-1.5 text-sm transition", isSelected ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600")}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Base location</Label>
              <Input value={professionalDraft.location} onChange={(event) => setProfessionalDraft({ ...professionalDraft, location: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Service radius (km)</Label>
              <Input type="number" min={1} max={500} value={professionalDraft.serviceRadius ?? 25} onChange={(event) => setProfessionalDraft({ ...professionalDraft, serviceRadius: Number(event.target.value || 25) })} />
            </div>
            <div className="space-y-2">
              <Label>Years experience</Label>
              <Input type="number" min={0} max={80} value={professionalDraft.yearsExperience ?? ""} onChange={(event) => setProfessionalDraft({ ...professionalDraft, yearsExperience: event.target.value ? Number(event.target.value) : null })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Business name</Label>
              <Input value={professionalDraft.businessName ?? ""} onChange={(event) => setProfessionalDraft({ ...professionalDraft, businessName: event.target.value || null })} placeholder="Optional" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>About your work</Label>
              <Textarea value={professionalDraft.bio} onChange={(event) => setProfessionalDraft({ ...professionalDraft, bio: event.target.value })} rows={6} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Credentials or trust notes</Label>
              <Textarea value={professionalDraft.credentials ?? ""} onChange={(event) => setProfessionalDraft({ ...professionalDraft, credentials: event.target.value || null })} rows={3} placeholder="Optional for now" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={saveProfessionalReview} disabled={busyAction === "save-profile"}>{busyAction === "save-profile" ? "Saving..." : "Save changes"}</Button>
            {session.currentStep === "PROFILE_REVIEW" && <Button onClick={confirmIntakeReview} disabled={busyAction === "confirm-intake"}>Continue to personal details</Button>}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderPersonalForm = (showSummary: boolean) => (
    <div className="space-y-5">
      {showSummary && (
        <Card className="border-slate-200 bg-slate-50/80">
          <CardContent className="pt-5 text-sm text-slate-600">
            <p className="font-medium text-slate-900">{session?.role === "CUSTOMER" ? customerDraft?.title : professionalDraft?.bio?.slice(0, 84) || "Profile ready"}</p>
            <p className="mt-2">
              {session?.role === "CUSTOMER"
                ? `${customerDraft?.categoryLabel || "Category pending"} · ${customerDraft?.locationText || "Location pending"}`
                : `${professionalDraft?.categoryLabels.join(", ") || "Trades pending"} · ${professionalDraft?.location || "Coverage pending"}`}
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>First name</Label>
          <Input value={personalDraft.firstName ?? ""} onChange={(event) => setPersonalDraft({ ...personalDraft, firstName: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Last name</Label>
          <Input value={personalDraft.lastName ?? ""} onChange={(event) => setPersonalDraft({ ...personalDraft, lastName: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Email address</Label>
          <Input type="email" value={personalDraft.email ?? ""} onChange={(event) => setPersonalDraft({ ...personalDraft, email: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Phone number</Label>
          <Input type="tel" value={personalDraft.phone ?? ""} onChange={(event) => setPersonalDraft({ ...personalDraft, phone: event.target.value })} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={savePersonalDetails} disabled={busyAction === "save-personal"}>{busyAction === "save-personal" ? "Saving..." : "Save details"}</Button>
        {session?.currentStep === "PERSONAL_DETAILS" && <Button onClick={savePersonalDetails} disabled={busyAction === "save-personal"}>Continue to confirmation</Button>}
      </div>
    </div>
  );

  const renderPersonalReview = () => (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle className="text-lg">{session?.role === "CUSTOMER" ? "Job summary" : "Professional summary"}</CardTitle></CardHeader>
          <CardContent>{renderStructuredSummary()}</CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle className="text-lg">Personal details</CardTitle></CardHeader>
          <CardContent>{renderPersonalForm(false)}</CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={confirmPersonalReview} disabled={busyAction === "confirm-personal"}>Continue to phone verification</Button>
      </div>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6">
        <div className="mb-3 inline-flex rounded-2xl bg-slate-900 p-3 text-white">{channelForOtp === "PHONE" ? <Phone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}</div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{channelForOtp === "PHONE" ? "Verify your phone" : "Verify your email"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Enter the demo verification code sent to <strong>{maskTarget(otpTarget, channelForOtp)}</strong>. Editing the contact detail later will require a fresh verification.</p>
        <div className="mt-4 inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white">Demo code {DEMO_OTP_CODE}</div>
      </div>
      <div className="space-y-3">
        <Label>Verification code</Label>
        <Input value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={DEMO_OTP_CODE} className="h-12 text-center text-xl tracking-[0.4em]" inputMode="numeric" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => verifyOtp(channelForOtp)} disabled={busyAction === `verify-${channelForOtp.toLowerCase()}` || otpCode.length !== 6}>{busyAction === `verify-${channelForOtp.toLowerCase()}` ? "Verifying..." : "Confirm code"}</Button>
        <Button variant="outline" onClick={() => sendOtp(channelForOtp)} disabled={busyAction === `send-${channelForOtp.toLowerCase()}`}>{busyAction === `send-${channelForOtp.toLowerCase()}` ? "Sending..." : "Resend code"}</Button>
      </div>
    </div>
  );

  const renderPasswordStep = () => (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6">
        <div className="mb-3 inline-flex rounded-2xl bg-slate-950 p-3 text-white"><LockKeyhole className="h-5 w-5" /></div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Set your password</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Both verifications are complete. Choose a password to finish account creation and continue directly into your dashboard.</p>
      </div>
      <div className="space-y-3">
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters, with a letter and a number" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Minimum 8 characters</div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">At least one letter</div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">At least one number</div>
      </div>
      <Button onClick={completeOnboarding} disabled={busyAction === "complete"}>{busyAction === "complete" ? "Creating account..." : "Create account and continue"}</Button>
    </div>
  );

  const renderChatIntake = () => (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-slate-50/90 p-5">
        <p className="text-sm leading-6 text-slate-600">{session?.role === "CUSTOMER" ? "Start with the problem, what service you think you need, the location, and how urgent it feels." : "Start with the trade, where you cover, what kind of jobs you want, and the experience or trust signals customers should know."}</p>
      </div>
      <Card className="overflow-hidden rounded-[28px] border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-2.5 text-white"><Bot className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">ServiceConnect AI</CardTitle>
              <p className="text-sm text-slate-500">Structured intake with live role-aware validation</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <ScrollArea className="h-[360px] px-5 py-5">
            <div className="space-y-4">
              {session?.transcript.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className={cn("flex", entry.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-6", entry.role === "user" ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-700")}>{entry.content}</div>
                </div>
              ))}
              {busyAction === "chat" && <div className="flex justify-start"><div className="inline-flex items-center gap-2 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Thinking through the next question...</div></div>}
              <div ref={transcriptBottomRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-slate-100 p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {roleMeta?.chips.map((chip) => (
                <button key={chip} type="button" onClick={() => setChatMessage(chip)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900">{chip}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <Textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} rows={3} placeholder={session?.role === "CUSTOMER" ? "Tell the assistant about the job..." : "Tell the assistant about your trade and coverage..."} className="min-h-[92px] flex-1 rounded-[24px]" />
              <Button className="self-end" onClick={submitChat} disabled={busyAction === "chat" || !chatMessage.trim()}>Send</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMainStage = () => {
    if (completionState) {
      return (
        <div className="space-y-5 text-center">
          <div className="mx-auto inline-flex rounded-full bg-emerald-100 p-4 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Account ready</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{completionState.nextPrompt || "Routing you to your dashboard now."}</p>
          </div>
          {completionState.jobStatus && <Badge className={completionState.jobStatus === "LIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>First job saved as {completionState.jobStatus}</Badge>}
        </div>
      );
    }

    if (bootstrapping || busyAction === "bootstrap") {
      return <div className="flex min-h-[360px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-500" /><p className="text-sm text-slate-500">Restoring your onboarding session...</p></div></div>;
    }

    if (!roleParam && !session) {
      return <RoleSelector onChoose={navigateForRole} />;
    }

    if (!session) {
      return <div className="flex min-h-[360px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-500" /><p className="text-sm text-slate-500">Preparing your onboarding flow...</p></div></div>;
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-2.5 text-white shadow-lg"><Sparkles className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-950">ServiceConnect</p>
              <p className="text-xs text-slate-500">Role-aware AI onboarding</p>
            </div>
          </Link>
          {!user && <div className="text-sm text-slate-500">Already registered? <Link href="/login" className="font-medium text-slate-950 underline-offset-4 hover:underline">Sign in</Link></div>}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <aside className="space-y-6">
            <div className={cn("rounded-[32px] border border-white/70 bg-gradient-to-br p-7 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)]", roleMeta?.accentSoft ?? "from-slate-200 via-white to-white")}>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{roleMeta?.eyebrow || "AI Onboarding"}</p>
                  <h1 className="max-w-md text-4xl font-semibold tracking-tight text-slate-950">{roleMeta?.headline || "Choose how you want to use ServiceConnect."}</h1>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">{roleMeta?.intro || "Pick a role and the onboarding flow will adapt immediately."}</p>
                </div>
                {ActiveRoleIcon && <ActiveRoleIcon className={cn("mt-1 h-7 w-7", roleMeta.accent)} />}
              </div>
              <div className="mb-6 flex flex-wrap gap-3">
                {(["CUSTOMER", "PROFESSIONAL"] as OnboardingRole[]).map((role) => (
                  <button key={role} type="button" onClick={() => navigateForRole(role)} className={cn("rounded-full px-4 py-2 text-sm font-medium transition", activeRole === role ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950")}>
                    {role === "CUSTOMER" ? "Customer" : "Professional"}
                  </button>
                ))}
              </div>
              {roleMeta && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-500"><span>Progress</span><span>{progressIndex}/{roleMeta.steps.length - 1}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/90"><div className="h-full rounded-full bg-slate-950 transition-all duration-500" style={{ width: progressWidth }} /></div>
                  <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    {roleMeta.steps.map((step, index) => (
                      <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-600">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", index <= progressIndex ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500")}>{index === 0 ? <Sparkles className="h-3.5 w-3.5" /> : index}</div>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {session && (
              <Card className="rounded-[28px] border-white/70 bg-white/90 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55)]">
                <CardHeader><CardTitle className="text-lg">Live onboarding snapshot</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {session.role === "CUSTOMER" && customerDraft && (
                    <>
                      <div className="flex items-start gap-3">
                        <MessageSquareText className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-950">{customerDraft.title || "Job details in progress"}</p>
                          <p className="text-slate-500">{customerDraft.categoryLabel || "Category pending"} · {customerDraft.locationText || "Location pending"}</p>
                        </div>
                      </div>
                      <Badge variant="outline">Urgency: {customerDraft.urgency}</Badge>
                    </>
                  )}
                  {session.role === "PROFESSIONAL" && professionalDraft && (
                    <>
                      <div className="flex items-start gap-3">
                        <Wrench className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-950">{professionalDraft.categoryLabels.join(", ") || "Trade details in progress"}</p>
                          <p className="text-slate-500">{professionalDraft.location || "Coverage pending"}</p>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-slate-500">{professionalDraft.bio || "Bio pending"}</p>
                    </>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-slate-700"><UserRound className="h-4 w-4" /><span className="font-medium">Personal details</span></div>
                    <p className="text-slate-500">{personalDraft.firstName || "Name pending"} {personalDraft.lastName || ""}</p>
                    <p className="text-slate-500">{personalDraft.email || "Email pending"}</p>
                    <p className="text-slate-500">{personalDraft.phone || "Phone pending"}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" /><span className="font-medium text-slate-900">Phone</span></div>
                      <p className={cn("text-sm", session.verificationState.phoneVerified ? "text-emerald-700" : "text-slate-500")}>{session.verificationState.phoneVerified ? "Verified" : "Pending"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" /><span className="font-medium text-slate-900">Email</span></div>
                      <p className={cn("text-sm", session.verificationState.emailVerified ? "text-emerald-700" : "text-slate-500")}>{session.verificationState.emailVerified ? "Verified" : "Pending"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>

          <main>
            <Card className="min-h-[680px] rounded-[32px] border-white/70 bg-white/92 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55)]">
              <CardContent className="p-6 sm:p-8">{renderMainStage()}</CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
