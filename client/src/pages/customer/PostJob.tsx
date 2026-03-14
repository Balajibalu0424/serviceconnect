import { useState } from "react";
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
import { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator };

type Step = 1 | 2 | 3 | 4;

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
  const totalSteps = isLoggedIn ? 3 : 4;

  const handleJobSubmit = async () => {
    if (!job.categoryId || !job.title || !job.description) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setStep(isLoggedIn ? 2 : 2);
  };

  const handleAccountSubmit = async () => {
    setLoading(true);
    try {
      if (isLoggedIn) {
        // Post job directly
        const res = await apiRequest("POST", "/api/jobs", job);
        if (!res.ok) throw new Error((await res.json()).error);
        const newJob = await res.json();
        setJobId(newJob.id);
        setStep(4);
        toast({ title: "Job posted!", description: "Your job is now live." });
        await refreshUser();
        setLocation(`/jobs/${newJob.id}`);
        return;
      }

      // New user — use onboarding endpoint
      const res = await apiRequest("POST", "/api/onboarding/customer", {
        ...account,
        ...job
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      setJobId(data.jobId);
      await refreshUser();
      setStep(3);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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

  const progressPct = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><span className="font-bold">ServiceConnect</span></Link>
          {isLoggedIn && <Link href="/dashboard"><Button variant="ghost" size="sm">My Dashboard</Button></Link>}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of {totalSteps}</span>
            <span>{Math.round(progressPct)}% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {["Job Details", "Your Account", !isLoggedIn ? "Verify" : "", "Done"].filter(Boolean).map((label, i) => (
              <span key={i} className={cn("text-xs", i + 1 === step ? "text-primary font-medium" : "text-muted-foreground")}>{label}</span>
            ))}
          </div>
        </div>

        {/* Step 1: Job Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">What do you need done?</h1>
              <p className="text-muted-foreground">Tell us about your job — it's free to post</p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Select a category</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {categories.map((cat: any) => {
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
            </div>

            <div>
              <Label htmlFor="title">Job title</Label>
              <Input id="title" value={job.title} onChange={e => setJob(j => ({...j, title: e.target.value}))}
                placeholder="e.g. Fix leaking tap in kitchen" required data-testid="input-title" />
            </div>

            <div>
              <Label htmlFor="description">Describe the job</Label>
              <Textarea id="description" value={job.description} onChange={e => setJob(j => ({...j, description: e.target.value}))}
                placeholder="Provide as much detail as possible about what you need..." rows={4} required data-testid="input-description" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budgetMin">Budget from (€)</Label>
                <Input id="budgetMin" type="number" value={job.budgetMin} onChange={e => setJob(j => ({...j, budgetMin: e.target.value}))}
                  placeholder="50" data-testid="input-budget-min" />
              </div>
              <div>
                <Label htmlFor="budgetMax">Budget to (€)</Label>
                <Input id="budgetMax" type="number" value={job.budgetMax} onChange={e => setJob(j => ({...j, budgetMax: e.target.value}))}
                  placeholder="200" data-testid="input-budget-max" />
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

            <Button className="w-full gap-2" onClick={handleJobSubmit} data-testid="button-next">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Account (skip if logged in posting via different path) */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">{isLoggedIn ? "Confirm your details" : "Create your account"}</h1>
              <p className="text-muted-foreground">{isLoggedIn ? "Review before posting" : "Free to join — get quotes fast"}</p>
            </div>
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
                <p><strong>Category:</strong> {categories.find((c: any) => c.id === job.categoryId)?.name}</p>
                <p><strong>Location:</strong> {job.locationText}</p>
              </CardContent></Card>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleAccountSubmit} disabled={loading} data-testid="button-submit">
                {loading ? "Processing..." : isLoggedIn ? "Post Job" : "Create Account & Post"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {!isLoggedIn && <p className="text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
            </p>}
          </div>
        )}

        {/* Step 3: OTP Verification */}
        {step === 3 && !isLoggedIn && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">Verify your email</h1>
              <p className="text-muted-foreground">Enter the 6-digit code sent to {account.email}</p>
              <p className="text-xs text-accent font-medium mt-1">Demo mode — use code: <strong className="font-mono">123456</strong></p>
            </div>
            <div className="max-w-xs mx-auto">
              <Input
                type="text" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="123456" className="text-center text-2xl tracking-widest h-14 font-mono"
                data-testid="input-otp"
              />
            </div>
            <Button className="w-full gap-2" onClick={handleOtpVerify} disabled={loading || otp.length !== 6} data-testid="button-verify">
              {loading ? "Verifying..." : "Verify & Go Live"} <CheckCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Your job is live!</h1>
              <p className="text-muted-foreground">Professionals in your area are being notified. You'll hear back soon.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/dashboard"><Button className="w-full">Go to Dashboard</Button></Link>
              <Link href="/post-job"><Button variant="outline" className="w-full">Post Another Job</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
