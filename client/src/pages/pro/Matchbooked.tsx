import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Star, MapPin, Lock, Zap, Loader2, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

function UnlockModal({ job, onClose }: { job: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const unlock = useMutation({
    mutationFn: async (tier: "FREE" | "STANDARD") => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/unlock`, { tier });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data, tier) => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/matchbooked"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      refreshUser();
      if (tier === "STANDARD" && data.customerPhone) {
        toast({ title: "Unlocked!", description: `Customer's phone: ${data.customerPhone}` });
      } else {
        toast({ title: "Unlocked!", description: "Chat conversation ready." });
      }
      onClose();
      // Navigate directly to the new conversation
      if (data.conversationId) {
        setLocation(`/pro/chat?conversationId=${data.conversationId}`);
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white/90 dark:bg-black/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-heading font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Unlock Lead</h2>
        <p className="text-sm text-muted-foreground mb-1">Choose your access level for this job</p>
        <p className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1 mb-6 inline-block font-medium border border-primary/20">{job.title}</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => unlock.mutate("FREE")} disabled={unlock.isPending}
            className="p-5 rounded-2xl border-2 border-muted/50 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:border-primary/40 hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-lg transition-all text-left group"
            data-testid="button-unlock-free">
            <div className="w-10 h-10 rounded-xl bg-muted/60 dark:bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-heading font-bold text-base">Free</p>
            <p className="text-xs text-muted-foreground mt-1">Chat only</p>
            <p className="text-2xl font-bold mt-3 text-green-600 dark:text-green-400">0 <span className="text-sm font-normal text-muted-foreground">cr</span></p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">Contact masked</p>
          </button>
          <button
            onClick={() => unlock.mutate("STANDARD")}
            disabled={unlock.isPending || (user?.creditBalance || 0) < job.creditCost}
            className={cn(
              "p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden group",
              (user?.creditBalance || 0) >= job.creditCost
                ? "border-primary/50 bg-gradient-to-b from-primary/10 to-transparent hover:border-primary hover:shadow-[0_0_20px_rgba(var(--primary),0.2)]"
                : "border-border opacity-50 cursor-not-allowed"
            )}
            data-testid="button-unlock-standard">
            <div className="absolute top-0 right-0 h-16 w-16 bg-primary/10 blur-xl rounded-full" />
            <div className="absolute top-3 right-3">
              <Badge className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary hover:bg-primary/30 border-none">Best</Badge>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <p className="font-heading font-bold text-base relative z-10">Standard</p>
            <p className="text-xs text-muted-foreground mt-1 relative z-10">Chat + Phone</p>
            <p className="text-2xl font-bold mt-3 text-primary relative z-10">{job.creditCost} <span className="text-sm font-normal opacity-70">cr</span></p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium relative z-10">Full contact</p>
          </button>
        </div>
        {(user?.creditBalance || 0) < job.creditCost && (
          <p className="text-xs text-destructive mt-4 text-center font-medium bg-destructive/10 p-2 rounded-lg">
            You need {job.creditCost - (user?.creditBalance || 0)} more credits for Standard unlock.
          </p>
        )}
        <Button variant="outline" className="w-full mt-6 rounded-xl h-11" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function ProMatchbooked() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [unlockJob, setUnlockJob] = useState<any | null>(null);

  const { data: matchbooked = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs/matchbooked"],
  });

  const upgrade = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/upgrade`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/matchbooked"] });
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      toast({
        title: "Upgraded to Standard",
        description: data.customerPhone ? `Customer's phone: ${data.customerPhone}` : "Phone number unlocked — visible on the card.",
      });
      if (data.conversationId) {
        setLocation(`/pro/chat?conversationId=${data.conversationId}`);
      }
    },
    onError: (e: any) => toast({ title: "Upgrade failed", description: e.message, variant: "destructive" }),
  });

  const unmatchbook = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/matchbook`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/matchbooked"] });
      toast({ title: "Removed from matchbook" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Matchbooked</h1>
            <p className="text-sm text-muted-foreground mt-1">{(matchbooked as any[]).length} jobs saved</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl bg-white/40 dark:bg-white/5 animate-pulse" />)}
          </div>
        ) : (matchbooked as any[]).length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">Nothing saved yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">Matchbook jobs from the feed to save them here for later</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(matchbooked as any[]).map((row: any) => {
              const job = row.job || row;
              const mb = row.mb || {};
              const cat = row.cat || {};
              const isUnlocked = !!row.unlock;

              return (
                <Card key={mb.id || job.id} data-testid={`matchbook-${mb.id}`}
                  className={cn("transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group", isUnlocked && "border-green-500/40 bg-green-50/30 dark:bg-green-950/20")}>
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {cat.name && <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-white/50 dark:bg-black/50 backdrop-blur text-muted-foreground">{cat.name}</Badge>}
                          <Badge className="text-xs bg-white/50 dark:bg-black/50 backdrop-blur shadow-sm text-foreground">{job.status}</Badge>
                          {job.isBoosted && <Badge className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 border-none shadow-sm shadow-amber-500/20">Boosted</Badge>}
                          {isUnlocked && <Badge className="text-xs font-semibold bg-gradient-to-r from-green-500 to-green-600 text-white border-none shadow-sm shadow-green-500/20">Unlocked ({row.unlock?.tier})</Badge>}
                        </div>
                        <h3 className="font-heading font-bold text-lg md:text-xl group-hover:text-primary transition-colors">{job.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2 leading-relaxed">{job.description}</p>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-muted-foreground bg-white/40 dark:bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/20 dark:border-white/5 w-fit">
                          {job.locationText && (
                            <span className="flex items-center gap-1.5 font-medium text-foreground/80"><MapPin className="w-4 h-4 text-primary/70" />{job.locationText}</span>
                          )}
                          {mb.matchbookedAt && (
                            <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500/70 fill-amber-500/20" /> Saved {formatDistanceToNow(new Date(mb.matchbookedAt), { addSuffix: true })}</span>
                          )}
                          {job.budgetMin && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><Zap className="w-4 h-4 text-green-500/70" />€{job.budgetMin}–€{job.budgetMax}</span>}
                        </div>
                      </div>
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/40">
                        <p className="text-xs text-muted-foreground">Unlock cost</p>
                        <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">{job.creditCost} <span className="text-base font-normal">cr</span></p>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4 flex-wrap">
                      {!isUnlocked && (
                        <Button size="sm" className="gap-2 rounded-xl h-10 px-6 shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all w-full md:w-auto"
                          onClick={() => setUnlockJob(job)}
                          data-testid={`button-unlock-${job.id}`}>
                          <Lock className="w-4 h-4 fill-current" /> Claim Lead
                        </Button>
                      )}
                      {isUnlocked && row.unlock?.tier === "FREE" && (
                        <Button size="sm" variant="outline" className="gap-2 rounded-xl h-10 px-5 w-full md:w-auto border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => upgrade.mutate(job.id)} disabled={upgrade.isPending}
                          data-testid={`button-upgrade-${job.id}`}>
                          {upgrade.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                          Upgrade for phone ({job.creditCost} cr)
                        </Button>
                      )}
                      {isUnlocked && row.unlock?.tier === "STANDARD" && row.unlock?.customerPhone && (
                        <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-4 h-10 rounded-xl border border-green-200 dark:border-green-800">
                          <Phone className="w-3.5 h-3.5" /> {row.unlock.customerPhone}
                        </div>
                      )}
                      {isUnlocked && (
                        <Button size="sm" variant="default" className="rounded-xl h-10 px-6 w-full md:w-auto" asChild>
                          <a href={row.unlock?.conversationId ? `/#/pro/chat?conversationId=${row.unlock.conversationId}` : "/#/pro/chat"}>Open chat</a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground rounded-xl h-10 px-4 w-full md:w-auto hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => unmatchbook.mutate(job.id)} disabled={unmatchbook.isPending}>
                        {unmatchbook.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {unlockJob && <UnlockModal job={unlockJob} onClose={() => setUnlockJob(null)} />}
    </DashboardLayout>
  );
}
