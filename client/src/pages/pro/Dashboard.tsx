import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Star, CreditCard, MessageSquare, Dices, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProDashboard() {
  const { user } = useAuth();
  const { data: matchbooked = [] } = useQuery<any[]>({ queryKey: ["/api/jobs/matchbooked"] });
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const { data: spinStatus } = useQuery<any>({ queryKey: ["/api/spin-wheel/status"] });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Welcome back, {user?.firstName}!</h1>
          <p className="text-sm text-muted-foreground">Your professional dashboard</p>
        </div>

        {spinStatus?.eligible && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Dices className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Spin the Wheel available!</p>
                    <p className="text-xs text-muted-foreground">Win free credits, boosts, badges & more</p>
                  </div>
                </div>
                <Link href="/pro/spin"><Button size="sm">Spin Now</Button></Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Credits", value: user?.creditBalance || 0, icon: CreditCard, href: "/pro/credits", color: "text-primary" },
            { label: "Matchbooked", value: (matchbooked as any[]).length, icon: Star, href: "/pro/matchbooked", color: "text-yellow-500" },
            { label: "Bookings", value: (bookings as any[]).length, icon: Briefcase, href: "/pro/bookings", color: "text-accent" },
            { label: "Spin Streak", value: spinStatus?.spinStreak || 0, icon: TrendingUp, href: "/pro/spin", color: "text-orange-500" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="cursor-pointer hover:shadow-sm transition-all">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Matchbooked Jobs</CardTitle>
              <Link href="/pro/matchbooked"><Button variant="ghost" size="sm">View all</Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {(matchbooked as any[]).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No matchbooked jobs</p>
                <Link href="/pro/feed"><Button size="sm" variant="outline" className="mt-2">Browse job feed</Button></Link>
              </div>
            ) : (
              <div className="space-y-2">
                {(matchbooked as any[]).slice(0, 3).map((row: any) => (
                  <div key={row.mb?.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{row.job?.title}</p>
                      <p className="text-xs text-muted-foreground">{row.cat?.name}</p>
                    </div>
                    <Badge>{row.job?.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
