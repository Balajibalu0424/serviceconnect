import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Briefcase, CreditCard, TrendingUp, Zap, Lock,
  Download, BarChart3, Activity,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const DATE_PRESETS = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

function formatDay(day: string) {
  try {
    return format(parseISO(String(day)), "d MMM");
  } catch {
    return String(day);
  }
}

function filterByDays<T extends { day: string }>(data: T[], days: number): T[] {
  const cutoff = subDays(new Date(), days);
  return data.filter((row) => {
    try {
      return parseISO(String(row.day)) >= cutoff;
    } catch {
      return true;
    }
  });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-card/60 backdrop-blur-md border border-border/40 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 rounded-xl bg-card/60 backdrop-blur-md border border-border/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function KpiCard({ label, value, icon: Icon, color, bgColor }: KpiCardProps) {
  return (
    <Card className="backdrop-blur-md bg-card/60 border-border/40 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", bgColor)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium">Active</span>
        </div>
      </CardContent>
    </Card>
  );
}

function exportCSV(summary: Record<string, any>) {
  const headers = ["Metric", "Value"];
  const rows = [
    ["Total Users", summary.totalUsers ?? 0],
    ["Total Jobs", summary.totalJobs ?? 0],
    ["Active Jobs", summary.activeJobs ?? 0],
    ["Total Bookings", summary.totalBookings ?? 0],
    ["Total Unlocks", summary.totalUnlocks ?? 0],
    ["Total Revenue", summary.totalRevenue ?? 0],
  ];
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `serviceconnect-metrics-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminMetrics() {
  const [rangeDays, setRangeDays] = useState(30);

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

  const dailyJobs = useMemo(
    () =>
      filterByDays(data?.dailyJobs || [], rangeDays).map((r: any) => ({
        day: r.day,
        label: formatDay(r.day),
        count: Number(r.count),
      })),
    [data?.dailyJobs, rangeDays],
  );

  const dailyRevenue = useMemo(
    () =>
      filterByDays(data?.dailyRevenue || [], rangeDays).map((r: any) => ({
        day: r.day,
        label: formatDay(r.day),
        total: parseFloat(r.total || 0),
      })),
    [data?.dailyRevenue, rangeDays],
  );

  const dailyUsers = useMemo(
    () =>
      filterByDays(data?.dailyUsers || [], rangeDays).map((r: any) => ({
        day: r.day,
        label: formatDay(r.day),
        count: Number(r.count),
      })),
    [data?.dailyUsers, rangeDays],
  );

  const jobsByStatus = useMemo(
    () =>
      (data?.jobsByStatus || []).map((r: any) => ({
        name: r.status,
        value: Number(r.c),
      })),
    [data?.jobsByStatus],
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Platform Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Comprehensive metrics and marketplace insights
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Date range presets */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-card/60 backdrop-blur-sm border border-border/40">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant={rangeDays === preset.days ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs font-medium",
                    rangeDays === preset.days
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setRangeDays(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Export */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs backdrop-blur-sm bg-card/60 border-border/40"
              onClick={() => exportCSV(summary)}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Total Users" value={summary.totalUsers ?? "--"} icon={Users} color="text-blue-400" bgColor="bg-blue-500/10" />
              <KpiCard label="Total Jobs" value={summary.totalJobs ?? "--"} icon={Briefcase} color="text-emerald-400" bgColor="bg-emerald-500/10" />
              <KpiCard label="Active Jobs" value={summary.activeJobs ?? "--"} icon={Zap} color="text-yellow-400" bgColor="bg-yellow-500/10" />
              <KpiCard label="Bookings" value={summary.totalBookings ?? "--"} icon={Activity} color="text-purple-400" bgColor="bg-purple-500/10" />
              <KpiCard label="Unlocks" value={summary.totalUnlocks ?? "--"} icon={Lock} color="text-orange-400" bgColor="bg-orange-500/10" />
              <KpiCard
                label="Revenue"
                value={summary.totalRevenue ? `€${parseFloat(summary.totalRevenue).toFixed(2)}` : "€0.00"}
                icon={CreditCard}
                color="text-green-400"
                bgColor="bg-green-500/10"
              />
            </div>

            {/* Charts 2x2 Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily New Jobs - AreaChart green */}
              <Card className="backdrop-blur-md bg-card/60 border-border/40 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    Daily New Jobs
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Last {rangeDays}D
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyJobs.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                      No data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={dailyJobs}>
                        <defs>
                          <linearGradient id="gradJobs" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#gradJobs)"
                          name="Jobs"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Daily Revenue - AreaChart blue */}
              <Card className="backdrop-blur-md bg-card/60 border-border/40 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    Daily Revenue
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Last {rangeDays}D
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyRevenue.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                      No revenue data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={dailyRevenue}>
                        <defs>
                          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                          formatter={(v: any) => [`€${Number(v).toFixed(2)}`, "Revenue"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#gradRevenue)"
                          name="Revenue (€)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Daily New Signups - BarChart blue */}
              <Card className="backdrop-blur-md bg-card/60 border-border/40 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Daily New Signups
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Last {rangeDays}D
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyUsers.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                      No data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dailyUsers}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Signups" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Jobs by Status - PieChart */}
              <Card className="backdrop-blur-md bg-card/60 border-border/40 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Jobs by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {jobsByStatus.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                      No data yet
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={220}>
                        <PieChart>
                          <Pie
                            data={jobsByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {jobsByStatus.map((_: any, i: number) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {jobsByStatus.map((row: any, i: number) => (
                          <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <span className="capitalize text-muted-foreground">{row.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold">
                              {row.value}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
