import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, Briefcase, MessageSquare, Bell, Settings,
  LogOut, Menu, X, CreditCard, Zap, Users, Star, ChevronRight,
  ListChecks, Home, Dices, ShieldCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface NavItem { label: string; href: string; icon: any; badge?: number; }

function CustomerNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My Jobs", href: "/my-jobs", icon: Briefcase },
    { label: "Bookings", href: "/bookings", icon: ListChecks },
    { label: "Messages", href: "/chat", icon: MessageSquare },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Settings", href: "/settings", icon: Settings },
  ];
}

function ProNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/pro/dashboard", icon: LayoutDashboard },
    { label: "Job Feed", href: "/pro/feed", icon: Home },
    { label: "Matchbooked", href: "/pro/matchbooked", icon: Star },
    { label: "My Leads", href: "/pro/leads", icon: Users },
    { label: "Bookings", href: "/pro/bookings", icon: ListChecks },
    { label: "Messages", href: "/pro/chat", icon: MessageSquare },
    { label: "Credits", href: "/pro/credits", icon: CreditCard },
    { label: "Spin the Wheel", href: "/pro/spin", icon: Dices },
    { label: "My Profile", href: "/pro/profile", icon: Settings },
  ];
}

function AdminNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Jobs", href: "/admin/jobs", icon: Briefcase },
    { label: "Chat Monitor", href: "/admin/chat", icon: MessageSquare },
    { label: "Payments", href: "/admin/payments", icon: CreditCard },
    { label: "Support", href: "/admin/support", icon: ShieldCheck },
    { label: "Audit Logs", href: "/admin/audit", icon: ListChecks },
    { label: "Feature Flags", href: "/admin/flags", icon: Zap },
    { label: "Metrics", href: "/admin/metrics", icon: Star },
  ];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: notifData } = useQuery<any>({ queryKey: ["/api/notifications"] });
  const unreadCount = notifData?.unreadCount || 0;

  const navItems = user?.role === "ADMIN" ? AdminNav()
    : user?.role === "PROFESSIONAL" ? ProNav()
    : CustomerNav();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-sidebar-foreground">ServiceConnect</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.href.replace(/\//g, "-")}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Notifications" && unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs h-5 min-w-5">{unreadCount}</Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3 px-3 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-sidebar-foreground">{user?.firstName} {user?.lastName}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
          </div>
        </div>
        {user?.role === "PROFESSIONAL" && (
          <div className="px-3 pb-2 text-xs text-sidebar-foreground/70">
            <CreditCard className="inline w-3 h-3 mr-1" />
            {user.creditBalance} credits
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm">ServiceConnect</span>
          <div className="w-9" />
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
