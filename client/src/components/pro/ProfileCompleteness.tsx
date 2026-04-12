import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileCompletenessProps {
  user: {
    avatarUrl?: string | null;
    bio?: string | null;
  };
  profile: {
    businessName?: string | null;
    credentials?: string | null;
    serviceCategories?: string[] | null;
    serviceAreas?: string[] | null;
    yearsExperience?: number | null;
    website?: string | null;
    lat?: number | string | null;
    lng?: number | string | null;
    portfolio?: any[] | null;
  };
  compact?: boolean;
}

export function ProfileCompleteness({ user, profile, compact = false }: ProfileCompletenessProps) {
  const checks = [
    { id: "avatar", label: "Profile Photo", done: !!user?.avatarUrl },
    { id: "bio", label: "About You / Bio", done: !!user?.bio && user.bio.length > 10 },
    { id: "business", label: "Business Name", done: !!profile?.businessName },
    { id: "experience", label: "Years of Experience", done: (profile?.yearsExperience ?? 0) > 0 },
    { id: "categories", label: "Service Categories", done: !!profile?.serviceCategories?.length },
    { id: "serviceAreas", label: "Service Areas", done: !!profile?.serviceAreas?.length },
    { id: "location", label: "Base Location", done: !!profile?.lat && !!profile?.lng },
    { id: "website", label: "Website", done: !!profile?.website },
    { id: "credentials", label: "Credentials & Certifications", done: !!profile?.credentials && profile.credentials.length > 5 },
    { id: "portfolio", label: "Portfolio Examples", done: !!profile?.portfolio?.length },
  ];

  const completedCount = checks.filter((c) => c.done).length;
  const percentage = Math.round((completedCount / checks.length) * 100);
  const nextSteps = checks.filter((check) => !check.done).slice(0, 3);

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground flex items-center gap-1.5">
            {percentage < 100 ? (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            )}
            Profile Completeness
          </span>
          <span className={cn(
            percentage === 100 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-foreground"
          )}>{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-1.5" indicatorClassName={percentage === 100 ? "bg-emerald-500" : "bg-primary"} />
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-heading font-bold text-lg">Profile Completeness</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {percentage === 100 
              ? "Your profile is fully optimized to win jobs!" 
              : "Complete your profile to build trust and win 3x more jobs."}
          </p>
        </div>
        <div className="text-right">
          <span className={cn(
            "text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br",
            percentage === 100 ? "from-emerald-400 to-emerald-600" : "from-primary to-primary/60"
          )}>
            {percentage}%
          </span>
        </div>
      </div>

      <Progress value={percentage} className="h-2.5 mb-5" indicatorClassName={percentage === 100 ? "bg-emerald-500" : "bg-primary"} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-2.5">
            {check.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className={cn("text-sm", check.done ? "text-foreground font-medium" : "text-muted-foreground")}>
              {check.label}
            </span>
          </div>
        ))}
      </div>

      {nextSteps.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          Next up: {nextSteps.map((step) => step.label).join(", ")}
        </p>
      )}
    </div>
  );
}
