import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Users, Briefcase, CreditCard, ShieldCheck,
  TrendingUp, MessageSquare, Star,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/dashboard"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: metrics = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/metrics"],
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

  const statCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers ?? dashboard?.users?.total ?? "—",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Total Jobs",
      value: stats?.totalJobs ?? dashboard?.jobs?.total ?? "—",
      icon: Briefcase,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Total Bookings",
      value: stats?.totalBookings ?? dashboard?.bookings?.total ?? "—",
      icon: ShieldCheck,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Revenue",
      value: stats?.totalRevenue ? `€${Number(stats.totalRevenue).toFixed(2)}` : (dashboard?.revenue ? `€${Number(dashboard.revenue).toFixed(2)}` : "€0"),
      icon: CreditCard,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  // Build chart data from dashboard or metrics
  const chartData = (metrics as any[]).length > 0
    ? (metrics as any[]).slice(-7).map((m: any) => ({
        date: new Date(m.recordedAt || m.date).toLocaleDateString("en-IE", { weekday: "short" }),
        Users: m.totalUsers ?? m.newUsers ?? 0,
        Jobs: m.totalJobs ?? m.newJobs ?? 0,
        Revenue: Number(m.revenue ?? 0),
      }))
    : [];

  const STATUS_COLORS: Record<string, string> = {
    OPEN: "default", MATCHED: "secondary", BOOKED: "outline",
    COMPLETED: "secondary", CLOSED: "destructive",
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">ServiceConnect platform overview</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                </div>
                {isLoading ? (
                  <div className="h-7 w-16 rounded bg-muted animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold">{s.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick stats row from dashboard */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Open Jobs", value: dashboard.jobs?.open ?? "—", icon: Briefcase },
              { label: "Active Chats", value: dashboard.conversations?.active ?? "—", icon: MessageSquare },
              { label: "Avg Rating", value: dashboard.reviews?.averageRating ?? "—", icon: Star },
              { label: "Active Users (7d)", value: dashboard.users?.activeLastWeek ?? "—", icon: TrendingUp },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <s.icon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                  <p className="text-xl font-bold mt-1">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">User & Job Growth (7 days)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="Users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Jobs" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: any) => [`€${v}`, "Revenue"]} />
                    <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent activity */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Users</CardTitle></CardHeader>
            <CardContent>
              {(recentUsers as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users</p>
              ) : (
                <div className="space-y-2">
                  {(recentUsers as any[]).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">{u.role}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Jobs</CardTitle></CardHeader>
            <CardContent>
              {(recentJobs as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No jobs</p>
              ) : (
                <div className="space-y-2">
                  {(recentJobs as any[]).map((j: any) => (
                    <div key={j.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="font-medium truncate">{j.title}</p>
                        <p className="text-xs text-muted-foreground">{j.locationText || "Ireland"}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={STATUS_COLORS[j.status] as any} className="text-xs">{j.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
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
