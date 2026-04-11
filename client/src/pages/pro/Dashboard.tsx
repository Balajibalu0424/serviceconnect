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
  Users, ArrowRight, Zap, ChevronRight, BadgeCheck, Clock,
  Bell, AlertTriangle, Wrench
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProDashboard() {
  const { user } = useAuth();
  const { data: matchbooked = [] } = useQuery<any[]>({ queryKey: ["/api/jobs/matchbooked"] });
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const { data: spinStatus } = useQuery<any>({ queryKey: ["/api/spin-wheel/status"] });
  const { data: quotesRaw } = useQuery<any>({ queryKey: ["/api/quotes"] });
  const { data: conversations = [] } = useQuery<any[]>({ queryKey: ["/api/chat/conversations"] });
  const { data: notifData } = useQuery<any>({ queryKey: ["/api/notifications"] });
  const { data: profile } = useQuery<any>({ queryKey: ["/api/pro/profile"] });

  const quotes: any[] = Array.isArray(quotesRaw) ? quotesRaw : (quotesRaw?.quotes || []);
  const activeBookings = (bookings as any[]).filter(b => b.status === "ACTIVE" || b.status === "CONFIRMED");
  const completedBookings = (bookings as any[]).filter(b => b.status === "COMPLETED");
  const pendingQuotes = quotes.filter(q => q.status === "PENDING");
  const unreadNotifCount = notifData?.unreadCount || 0;

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

        {/* Category setup banner */}
        {(!profile?.serviceCategories?.length || profile?.serviceCategories?.length === 0) && (
          <div className="bg-amber-50/80 dark:bg-amber-950/20 backdrop-blur-xl border border-amber-200/60 dark:border-amber-500/20 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 border border-amber-500/20">
                <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Complete your profile to see relevant jobs</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">Add your trade categories to get matched with the right jobs in your feed.</p>
              </div>
            </div>
            <Link href="/pro/profile" className="shrink-0">
              <Button size="sm" className="gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20">
                <Wrench className="w-3.5 h-3.5" /> Set Up Profile
              </Button>
            </Link>
          </div>
        )}

        {/* Spin wheel banner — always visible, with countdown when on cooldown */}
        {spinStatus && (
          <Link href="/pro/spin">
            <div className={`relative overflow-hidden group rounded-2xl border shadow-sm p-5 md:p-6 cursor-pointer transition-all hover:shadow-md ${
              spinStatus.eligible
                ? "border-primary/20 dark:border-primary/10 bg-gradient-to-r from-primary/10 via-primary/5 to-indigo-500/10"
                : "border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 via-amber-25 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10"
            }`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 dark:bg-primary/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    spinStatus.eligible
                      ? "bg-gradient-to-br from-primary to-indigo-600"
                      : "bg-gradient-to-br from-amber-400 to-orange-500"
                  }`}>
                    <Dices className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold text-base font-outfit ${
                      spinStatus.eligible ? "text-primary dark:text-primary/90" : "text-amber-700 dark:text-amber-400"
                    }`}>
                      {spinStatus.eligible ? "🎉 Spin the Wheel is ready!" : "Spin the Wheel"}
                    </h3>
                    <p className={`text-sm mt-0.5 ${
                      spinStatus.eligible ? "text-primary/80 dark:text-primary/70" : "text-amber-600/80 dark:text-amber-400/70"
                    }`}>
                      {spinStatus.eligible
                        ? "Win free credits, boosts, profile badges & more. Tap to spin!"
                        : spinStatus.nextEligibleAt
                          ? `Next spin available ${formatDistanceToNow(new Date(spinStatus.nextEligibleAt), { addSuffix: true })}${spinStatus.spinStreak > 1 ? ` · ${spinStatus.spinStreak} streak 🔥` : ""}`
                          : "Win free credits, boosts & badges every 72 hours"
                      }
                    </p>
                  </div>
                </div>
                <Button className={`gap-2 shrink-0 shadow-md rounded-xl ${
                  spinStatus.eligible
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                }`}>
                  <Dices className="w-4 h-4" /> {spinStatus.eligible ? "Spin Now" : "View Spin Wheel"}
                </Button>
              </div>
            </div>
          </Link>
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
              label: "Notifications",
              value: unreadNotifCount,
              icon: Bell,
              href: "/pro/notifications",
              color: "text-orange-500",
              bg: "from-orange-500/10 to-amber-500/10",
              sub: "unread"
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

        {/* Actions Required banner */}
        {(unreadNotifCount > 0 || pendingQuotes.length > 0 || activeBookings.length > 0) && (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-indigo-200/60 dark:border-indigo-500/20 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-indigo-50/60 dark:bg-indigo-500/10 border-b border-indigo-100/60 dark:border-indigo-500/10 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-bold font-outfit text-indigo-700 dark:text-indigo-300">Actions Required</span>
            </div>
            <div className="divide-y divide-border/40">
              {unreadNotifCount > 0 && (
                <Link href="/pro/notifications">
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer group">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                      <Bell className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {unreadNotifCount} unread notification{unreadNotifCount !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Stay updated with your leads and bookings</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              )}
              {pendingQuotes.length > 0 && (
                <Link href="/pro/leads">
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer group">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {pendingQuotes.length} quote{pendingQuotes.length !== 1 ? "s" : ""} awaiting customer response
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Track quote outcomes in My Leads</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              )}
              {activeBookings.length > 0 && (
                <Link href="/pro/bookings">
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer group">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                      <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {activeBookings.length} active booking{activeBookings.length !== 1 ? "s" : ""} in progress
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Keep the customer updated</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

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
                    <Link key={conv.id} href={`/pro/chat?conversationId=${conv.id}`}>
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
