import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Users, Briefcase, DollarSign, CheckCircle, AlertTriangle, Clock } from "lucide-react";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280", "#14B8A6"];

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data } = useQuery<any>({ queryKey: ["/api/admin/dashboard"] });
  const stats = data?.stats || {};
  const jobsByStatus = data?.jobsByStatus || [];
  const usersByRole = data?.usersByRole || [];
  const aftercareJobs = data?.aftercareJobs || [];

  const barData = jobsByStatus.map((r: any) => ({ name: r.status, value: parseInt(r.c) }));
  const pieData = usersByRole.map((r: any) => ({ name: r.role, value: parseInt(r.c) }));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.totalUsers || 0} icon={Users} color="bg-blue-500" />
          <StatCard label="Total Jobs" value={stats.totalJobs || 0} icon={Briefcase} color="bg-emerald-500" />
          <StatCard label="Revenue (€)" value={parseFloat(stats.totalRevenue || 0).toFixed(2)} icon={DollarSign} color="bg-amber-500" />
          <StatCard label="Bookings" value={stats.totalBookings || 0} icon={CheckCircle} color="bg-violet-500" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Jobs" value={stats.activeJobs || 0} icon={Briefcase} color="bg-blue-400" />
          <StatCard label="Open Tickets" value={stats.openTickets || 0} icon={AlertTriangle} color="bg-red-500" />
          <StatCard label="New Users (7d)" value={stats.recentUsers || 0} icon={Users} color="bg-green-500" />
          <StatCard label="New Jobs (7d)" value={stats.recentJobs || 0} icon={Clock} color="bg-orange-500" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Jobs by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Users by Role</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Aftercare Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {aftercareJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs in aftercare</p>
              ) : aftercareJobs.map((r: any) => (
                <div key={r.status} className="p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold">{r.c}</p>
                  <p className="text-xs text-muted-foreground">{r.status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
