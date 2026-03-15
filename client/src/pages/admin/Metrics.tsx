import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Users, Briefcase, CreditCard, TrendingUp, Zap, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDay(day: string) {
  try { return format(parseISO(String(day)), "d MMM"); } catch { return String(day); }
}

export default function AdminMetrics() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/metrics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/metrics");
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 60000,
  });

  const summary = data?.summary || {};
  const dailyJobs = (data?.dailyJobs || []).map((r: any) => ({ day: formatDay(r.day), count: r.count }));
  const dailyRevenue = (data?.dailyRevenue || []).map((r: any) => ({ day: formatDay(r.day), total: parseFloat(r.total || 0).toFixed(2) }));
  const dailyUsers = (data?.dailyUsers || []).map((r: any) => ({ day: formatDay(r.day), count: r.count }));

  const jobsByStatus = (data?.jobsByStatus || []).map((r: any) => ({
    name: r.status, value: r.c,
  }));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Platform Metrics</h1>
          <p className="text-sm text-muted-foreground">Live stats — last 30 days</p>
        </div>

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Users" value={summary.totalUsers ?? "—"} icon={Users} color="bg-blue-500/10 text-blue-500" />
          <StatCard label="Total Jobs" value={summary.totalJobs ?? "—"} icon={Briefcase} color="bg-emerald-500/10 text-emerald-500" />
          <StatCard label="Active Jobs" value={summary.activeJobs ?? "—"} icon={Zap} color="bg-yellow-500/10 text-yellow-500" />
          <StatCard label="Bookings" value={summary.totalBookings ?? "—"} icon={TrendingUp} color="bg-purple-500/10 text-purple-500" />
          <StatCard label="Unlocks" value={summary.totalUnlocks ?? "—"} icon={Lock} color="bg-orange-500/10 text-orange-500" />
          <StatCard
            label="Revenue"
            value={summary.totalRevenue ? `€${parseFloat(summary.totalRevenue).toFixed(2)}` : "€0.00"}
            icon={CreditCard}
            color="bg-green-500/10 text-green-500"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Jobs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  Jobs Posted (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyJobs.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyJobs}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} name="Jobs" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Daily Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-green-500" />
                  Daily Revenue (€)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyRevenue.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [`€${v}`, "Revenue"]} />
                      <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue (€)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Daily New Users */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  New Signups (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyUsers.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyUsers}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Signups" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Jobs by Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Jobs by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobsByStatus.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie data={jobsByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                          {jobsByStatus.map((_: any, i: number) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {jobsByStatus.map((row: any, i: number) => (
                        <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span>{row.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">{row.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
