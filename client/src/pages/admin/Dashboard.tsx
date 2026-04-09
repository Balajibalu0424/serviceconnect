import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Briefcase, BriefcaseBusiness, DollarSign,
  CalendarCheck, CheckCircle2, FileText, Unlock,
  ShieldAlert, TicketCheck, AlertTriangle, MessageSquareWarning,
  Star, TrendingUp, Activity, ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const glass = "bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm";

interface EnhancedDashboard {
  kpis: Record<string, number>;
  trends: { recentUsers: number; recentJobs: number; recentBookings: number };
  health: { quoteConversion: number; bookingCompletion: number };
  breakdowns: {
    usersByRole: { role: string; c: number }[];
    jobsByStatus: { status: string; c: number }[];
    bookingsByStatus: { status: string; c: number }[];
  };
}

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useQuery<EnhancedDashboard>({
    queryKey: ["/api/admin/dashboard/enhanced"],
  });

  const { data: recentUsers = [] } = useQuery<any[]>({
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users?limit=5");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.slice(0, 5) : (data.users || []).slice(0, 5);
    },
    queryKey: ["/api/admin/users", "recent"],
  });

  const { data: recentJobs = [] } = useQuery<any[]>({
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/jobs?limit=5");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.slice(0, 5) : (data.jobs || []).slice(0, 5);
    },
    queryKey: ["/api/admin/jobs", "recent"],
  });

  const k = dashboard?.kpis;
  const t = dashboard?.trends;

  const kpiCards = [
    { label: "Total Users",       value: k?.totalUsers,        icon: Users,             bg: "bg-blue-500/15",    color: "text-blue-500",    trend: t?.recentUsers,   trendLabel: "this week" },
    { label: "Total Jobs",        value: k?.totalJobs,         icon: Briefcase,         bg: "bg-violet-500/15",  color: "text-violet-500",  trend: t?.recentJobs,    trendLabel: "this week" },
    { label: "Active Jobs",       value: k?.activeJobs,        icon: BriefcaseBusiness, bg: "bg-emerald-500/15", color: "text-emerald-500", trend: null,             trendLabel: "" },
    { label: "Revenue",           value: k?.totalRevenue,      icon: DollarSign,        bg: "bg-amber-500/15",   color: "text-amber-500",   trend: null,             trendLabel: "", isCurrency: true },
    { label: "Total Bookings",    value: k?.totalBookings,     icon: CalendarCheck,     bg: "bg-cyan-500/15",    color: "text-cyan-500",    trend: t?.recentBookings, trendLabel: "this week" },
    { label: "Completed",         value: k?.completedBookings, icon: CheckCircle2,      bg: "bg-green-500/15",   color: "text-green-500",   trend: null,             trendLabel: "" },
    { label: "Total Quotes",      value: k?.totalQuotes,       icon: FileText,          bg: "bg-pink-500/15",    color: "text-pink-500",    trend: null,             trendLabel: "" },
    { label: "Total Unlocks",     value: k?.totalUnlocks,      icon: Unlock,            bg: "bg-orange-500/15",  color: "text-orange-500",  trend: null,             trendLabel: "" },
  ];

  const alerts = [
    { label: "Pending Verifications", count: k?.pendingVerifications ?? 0, icon: ShieldAlert,          accent: "border-red-500/40 bg-red-500/10",     text: "text-red-600 dark:text-red-400",    link: "/admin/users" },
    { label: "Open Tickets",          count: k?.openTickets ?? 0,          icon: TicketCheck,          accent: "border-amber-500/40 bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", link: "/admin/support" },
    { label: "Disputed Bookings",     count: k?.disputedBookings ?? 0,     icon: AlertTriangle,        accent: "border-red-500/40 bg-red-500/10",     text: "text-red-600 dark:text-red-400",    link: "/admin/bookings" },
    { label: "Flagged Messages",      count: k?.flaggedMessages ?? 0,      icon: MessageSquareWarning, accent: "border-amber-500/40 bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", link: "/admin/chat" },
  ].filter((a) => a.count > 0);

  const quoteConv = parseFloat(String(dashboard?.health?.quoteConversion ?? 0));
  const bookComp = parseFloat(String(dashboard?.health?.bookingCompletion ?? 0));
  const avgRating = parseFloat(String(k?.avgRating ?? 0));

  const STATUS_BADGE: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    MATCHED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    BOOKED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };

  const Shimmer = () => <div className="h-7 w-20 rounded-lg bg-muted/60 animate-pulse" />;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1440px] mx-auto">

        {/* ── GRADIENT HEADER ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-violet-900 p-8 md:p-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2em0wIDMyYzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Command Center</h1>
              </div>
              <p className="text-blue-200/80 text-sm md:text-base ml-[52px]">Platform overview and marketplace health</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-blue-200/60">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>
          </div>
        </div>

        {/* ── TOP KPI ROW ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            const displayValue = card.isCurrency
              ? `€${Number(card.value ?? 0).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : (card.value ?? 0).toLocaleString();
            return (
              <Card key={card.label} className={cn(glass, "hover:shadow-lg transition-all group")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                      <Icon className={cn("w-5 h-5", card.color)} />
                    </div>
                    {card.trend != null && card.trend > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                        <TrendingUp className="w-3 h-3" />
                        +{card.trend} {card.trendLabel}
                      </span>
                    )}
                  </div>
                  {isLoading ? <Shimmer /> : (
                    <p className="text-2xl font-bold tracking-tight">{displayValue}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">{card.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── ALERTS ROW ── */}
        {alerts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <Link key={alert.label} href={alert.link}>
                  <Card className={cn("border-2 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all", alert.accent)}>
                    <CardContent className="p-5 flex items-center gap-4">
                      <Icon className={cn("w-6 h-6 shrink-0", alert.text)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-2xl font-bold", alert.text)}>{alert.count}</p>
                        <p className="text-xs font-medium text-muted-foreground truncate">{alert.label}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── MARKETPLACE HEALTH ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={cn(glass)}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Quote Conversion Rate</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{quoteConv.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground mb-1">{k?.acceptedQuotes ?? 0} / {k?.totalQuotes ?? 0} accepted</span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700" style={{ width: `${Math.min(quoteConv, 100)}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(glass)}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Booking Completion Rate</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{bookComp.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground mb-1">{k?.completedBookings ?? 0} / {k?.totalBookings ?? 0} completed</span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700" style={{ width: `${Math.min(bookComp, 100)}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(glass)}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Average Rating</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground mb-1">from {k?.totalReviews ?? 0} reviews</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn("w-5 h-5", s <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── BREAKDOWN CHARTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Users by Role */}
          <Card className={cn(glass, "overflow-hidden")}>
            <CardHeader className="pb-2 border-b border-border/30">
              <CardTitle className="text-sm font-semibold">Users by Role</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {dashboard?.breakdowns?.usersByRole?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={dashboard.breakdowns.usersByRole}
                      dataKey="c"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {dashboard.breakdowns.usersByRole.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Jobs by Status */}
          <Card className={cn(glass, "overflow-hidden")}>
            <CardHeader className="pb-2 border-b border-border/30">
              <CardTitle className="text-sm font-semibold">Jobs by Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {dashboard?.breakdowns?.jobsByStatus?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={dashboard.breakdowns.jobsByStatus}
                      dataKey="c"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {dashboard.breakdowns.jobsByStatus.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Bookings by Status */}
          <Card className={cn(glass, "overflow-hidden")}>
            <CardHeader className="pb-2 border-b border-border/30">
              <CardTitle className="text-sm font-semibold">Bookings by Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {dashboard?.breakdowns?.bookingsByStatus?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dashboard.breakdowns.bookingsByStatus} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    />
                    <Bar dataKey="c" name="Count" radius={[0, 6, 6, 0]}>
                      {dashboard.breakdowns.bookingsByStatus.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RECENT ACTIVITY ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Users */}
          <Card className={cn(glass, "overflow-hidden")}>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/30 pb-3">
              <CardTitle className="text-sm font-semibold">Recent Users</CardTitle>
              <Link href="/admin/users">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {(recentUsers as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>
              ) : (
                <div className="space-y-1">
                  {(recentUsers as any[]).map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(u.firstName?.[0] ?? "").toUpperCase()}{(u.lastName?.[0] ?? "").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px] font-semibold">{u.role}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card className={cn(glass, "overflow-hidden")}>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/30 pb-3">
              <CardTitle className="text-sm font-semibold">Recent Jobs</CardTitle>
              <Link href="/admin/jobs">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {(recentJobs as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No jobs yet</p>
              ) : (
                <div className="space-y-1">
                  {(recentJobs as any[]).map((j: any) => (
                    <div key={j.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{j.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{j.locationText || "Ireland"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_BADGE[j.status] ?? "bg-muted text-muted-foreground")}>
                          {j.status}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
