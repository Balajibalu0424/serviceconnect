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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.firstName}!</h1>
            <p className="text-sm text-muted-foreground">Your professional dashboard</p>
          </div>
          <Link href="/pro/feed">
            <Button size="sm" className="gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Browse Jobs
            </Button>
          </Link>
        </div>

        {/* Spin wheel banner */}
        {spinStatus?.eligible && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/8 to-primary/4">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                    <Dices className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Spin the Wheel available!</p>
                    <p className="text-xs text-muted-foreground">Win free credits, boosts, badges & more — 72h cooldown</p>
                  </div>
                </div>
                <Link href="/pro/spin">
                  <Button size="sm" className="gap-1.5">
                    <Dices className="w-3.5 h-3.5" /> Spin Now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Matchbooked",
              value: (matchbooked as any[]).length,
              icon: Star,
              href: "/pro/matchbooked",
              color: "text-amber-500",
              bg: "bg-amber-50 dark:bg-amber-950/30",
              sub: "saved leads"
            },
            {
              label: "Active Bookings",
              value: activeBookings.length,
              icon: Briefcase,
              href: "/pro/bookings",
              color: "text-primary",
              bg: "bg-primary/5",
              sub: "in progress"
            },
            {
              label: "Pending Quotes",
              value: pendingQuotes.length,
              icon: TrendingUp,
              href: "/pro/leads",
              color: "text-blue-500",
              bg: "bg-blue-50 dark:bg-blue-950/30",
              sub: "awaiting response"
            },
            {
              label: "Jobs Done",
              value: completedBookings.length,
              icon: BadgeCheck,
              href: "/pro/bookings",
              color: "text-green-600",
              bg: "bg-green-50 dark:bg-green-950/30",
              sub: "completed"
            },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="cursor-pointer hover:shadow-sm hover:border-border/80 transition-all">
                <CardContent className="pt-4 pb-4">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Credit balance card */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Credit Balance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${creditColor}`}>{credits}</span>
                <Badge variant="secondary" className="text-xs">{creditLevel}</Badge>
              </div>
            </div>
            <Progress value={creditProgress} className="h-1.5 mb-3" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {credits === 0
                  ? "No credits — top up to unlock jobs"
                  : credits < 5
                  ? "Running low — top up before missing leads"
                  : `Enough for ${Math.floor(credits / 2)}–${credits} job unlocks`}
              </p>
              <Link href="/pro/credits">
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                  <Zap className="w-3 h-3" /> Top Up
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Two column: matchbooked + recent conversations */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Matchbooked jobs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Matchbooked Jobs
                </CardTitle>
                <Link href="/pro/matchbooked">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View all <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(matchbooked as any[]).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No matchbooked jobs yet</p>
                  <p className="text-xs mt-1">Browse the feed and matchbook interesting leads</p>
                  <Link href="/pro/feed">
                    <Button size="sm" variant="outline" className="mt-3">Browse job feed</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {(matchbooked as any[]).slice(0, 4).map((row: any) => (
                    <div key={row.mb?.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{row.job?.title}</p>
                        <p className="text-xs text-muted-foreground">{row.cat?.name}</p>
                      </div>
                      <Badge variant={row.job?.status === "LIVE" ? "default" : "secondary"} className="ml-2 text-xs shrink-0">
                        {row.job?.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent messages */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Recent Messages
                </CardTitle>
                <Link href="/pro/chat">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View all <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(conversations as any[]).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Unlock a job to start chatting with customers</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(conversations as any[]).slice(0, 4).map((conv: any) => (
                    <Link key={conv.id} href={`/pro/chat?conv=${conv.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{conv.jobTitle || "Job conversation"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : "No messages yet"}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs h-5 min-w-5 shrink-0">{conv.unreadCount}</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/pro/feed"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><Briefcase className="w-3 h-3" /> Browse Feed</Button></Link>
              <Link href="/pro/credits"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><CreditCard className="w-3 h-3" /> Buy Credits</Button></Link>
              <Link href="/pro/profile"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><BadgeCheck className="w-3 h-3" /> My Profile</Button></Link>
              <Link href="/pro/spin"><Button size="sm" variant="outline" className="gap-1.5 text-xs"><Dices className="w-3 h-3" /> Spin Wheel</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
