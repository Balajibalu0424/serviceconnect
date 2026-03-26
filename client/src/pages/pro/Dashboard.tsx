import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase, Star, CreditCard, MessageSquare, Dices, TrendingUp,
  Users, ArrowRight, Zap, ChevronRight, BadgeCheck, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProDashboard() {
  const { user } = useAuth();
  const { data: matchbooked = [] } = useQuery<any[]>({ queryKey: ["/api/jobs/matchbooked"] });
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const { data: spinStatus } = useQuery<any>({ queryKey: ["/api/spin-wheel/status"] });
  const { data: quotes = [] } = useQuery<any[]>({ queryKey: ["/api/quotes"] });
  const { data: conversations = [] } = useQuery<any[]>({ queryKey: ["/api/conversations"] });

  const activeBookings = (bookings as any[]).filter(b => b.status === "ACTIVE" || b.status === "CONFIRMED");
  const completedBookings = (bookings as any[]).filter(b => b.status === "COMPLETED");
  const pendingQuotes = (quotes as any[]).filter(q => q.status === "PENDING");

  // Credit level indicator
  const credits = user?.creditBalance || 0;
  const creditLevel = credits >= 50 ? "Excellent" : credits >= 20 ? "Good" : credits >= 5 ? "Low" : "Critical";
  const creditColor = credits >= 20 ? "text-green-600 dark:text-green-400" : credits >= 5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const creditProgress = Math.min(100, (credits / 50) * 100);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-outfit text-foreground">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 dark:from-primary dark:to-indigo-400">{user?.firstName}</span>!
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Your professional command center. Find leads, manage bookings, and grow your business.
            </p>
          </div>
          <Link href="/pro/feed">
            <Button className="gap-2 shadow-lg shadow-primary/20 rounded-xl px-6" size="lg">
              <Briefcase className="w-5 h-5" /> Browse Job Feed
            </Button>
          </Link>
        </div>

        {/* Spin wheel banner */}
        {spinStatus?.eligible && (
          <div className="relative overflow-hidden group rounded-2xl border border-primary/20 dark:border-primary/10 bg-gradient-to-r from-primary/10 via-primary/5 to-indigo-500/10 shadow-sm p-5 md:p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 dark:bg-primary/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                  <Dices className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary dark:text-primary/90 text-base font-outfit">
                    Spin the Wheel is available!
                  </h3>
                  <p className="text-sm text-primary/80 dark:text-primary/70 mt-0.5">
                    Win free credits, boosts, profile badges & more — available every 72 hours.
                  </p>
                </div>
              </div>
              <Link href="/pro/spin">
                <Button className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 rounded-xl">
                  <Dices className="w-4 h-4" /> Spin Now
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            {
              label: "Matchbooked",
              value: (matchbooked as any[]).length,
              icon: Star,
              href: "/pro/matchbooked",
              color: "text-amber-500 dark:text-amber-400",
              bg: "from-amber-500/10 to-orange-500/10",
              sub: "saved leads"
            },
            {
              label: "Active Bookings",
              value: activeBookings.length,
              icon: Briefcase,
              href: "/pro/bookings",
              color: "text-indigo-600 dark:text-indigo-400",
              bg: "from-indigo-500/10 to-blue-500/10",
              sub: "in progress"
            },
            {
              label: "Pending Quotes",
              value: pendingQuotes.length,
              icon: TrendingUp,
              href: "/pro/leads",
              color: "text-blue-500 dark:text-blue-400",
              bg: "from-blue-500/10 to-cyan-500/10",
              sub: "awaiting response"
            },
            {
              label: "Jobs Done",
              value: completedBookings.length,
              icon: BadgeCheck,
              href: "/pro/bookings",
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "from-emerald-500/10 to-green-500/10",
              sub: "completed"
            },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="block group">
              <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 p-5 rounded-2xl shadow-sm group-hover:shadow-md group-hover:border-primary/20 transition-all duration-300 relative overflow-hidden">
                <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.bg} rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center mb-4 relative z-10 border border-white/20 dark:border-white/5`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="relative z-10">
                  <p className="text-3xl font-bold font-outfit">{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1 text-foreground/80">{stat.label}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{stat.sub}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Credit balance card */}
        <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 p-5 md:p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 dark:bg-primary/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span className="text-base font-bold font-outfit">Credit Balance</span>
                  <p className="text-xs text-muted-foreground">Used to unlock customer jobs</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold font-outfit ${creditColor}`}>{credits}</span>
                  <Badge variant="secondary" className="px-2 py-0.5 text-xs font-bold bg-muted/50 rounded-lg">{creditLevel}</Badge>
                </div>
              </div>
            </div>
            <Progress value={creditProgress} className="h-2 mb-4 bg-muted/50 dark:bg-muted/20" />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">
                {credits === 0
                  ? "No credits — top up to unlock jobs"
                  : credits < 5
                  ? "Running low — top up before missing leads"
                  : `Enough for ${Math.floor(credits / 2)}–${credits} job unlocks`}
              </p>
              <Link href="/pro/credits">
                <Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 hover:text-primary transition-all shadow-sm">
                  <Zap className="w-4 h-4 text-amber-500" /> Top Up Credits
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Two column: matchbooked + recent conversations */}
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
          {/* Matchbooked jobs */}
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-border/50 bg-white/40 dark:bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" /> Matchbooked Leads
              </h2>
              <Link href="/pro/matchbooked">
                <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-xl hover:bg-white/50 dark:hover:bg-white/10">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-3 md:p-4 flex-1">
              {(matchbooked as any[]).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-16 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/5 flex items-center justify-center mb-4">
                    <Star className="w-8 h-8 text-amber-500/40" />
                  </div>
                  <h3 className="text-md font-semibold font-outfit mb-1 relative z-10">No saved leads</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mb-6 relative z-10">Pin interesting jobs from the feed to review them later.</p>
                  <Link href="/pro/feed" className="relative z-10">
                    <Button variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 shadow-sm">
                      Browse job feed
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {(matchbooked as any[]).slice(0, 4).map((row: any) => (
                    <div key={row.mb?.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-transparent hover:border-border/60 hover:bg-white/50 dark:hover:bg-white/5 transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{row.job?.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{row.cat?.name}</p>
                      </div>
                      <Badge variant={row.job?.status === "LIVE" ? "default" : "secondary"} className="sm:ml-2 shrink-0 py-1 text-[11px] font-semibold w-fit">
                        {row.job?.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent messages */}
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-border/50 bg-white/40 dark:bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-500" /> Recent Messages
              </h2>
              <Link href="/pro/chat">
                <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-xl hover:bg-white/50 dark:hover:bg-white/10">
                  Open chat <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-3 md:p-4 flex-1">
              {(conversations as any[]).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/5 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-indigo-500/40" />
                  </div>
                  <h3 className="text-md font-semibold font-outfit mb-1 relative z-10">Your inbox is empty</h3>
                  <p className="text-sm text-muted-foreground max-w-xs relative z-10">Unlock a job to start chatting with potential customers.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {(conversations as any[]).slice(0, 4).map((conv: any) => (
                    <Link key={conv.id} href={`/pro/chat?conv=${conv.id}`}>
                      <div className="flex items-center gap-4 p-3.5 rounded-xl border border-transparent hover:border-border/60 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{conv.jobTitle || "Job conversation"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : "No messages yet"}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="px-2 py-0.5 h-auto text-xs font-bold rounded-full">{conv.unreadCount}</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Quick actions:</span>
          <Link href="/pro/feed" className="relative z-10"><Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm"><Briefcase className="w-3.5 h-3.5" /> Browse Feed</Button></Link>
          <Link href="/pro/credits" className="relative z-10"><Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm"><CreditCard className="w-3.5 h-3.5" /> Buy Credits</Button></Link>
          <Link href="/pro/profile" className="relative z-10"><Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm"><BadgeCheck className="w-3.5 h-3.5" /> My Profile</Button></Link>
          <Link href="/pro/spin" className="relative z-10"><Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm"><Dices className="w-3.5 h-3.5" /> Spin Wheel</Button></Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
