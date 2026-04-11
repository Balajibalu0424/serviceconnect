import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, Briefcase, MessageSquare, Bell, Settings,
  LogOut, Menu, X, CreditCard, Zap, Users, Star, ChevronRight,
  ListChecks, Home, Dices, ShieldCheck, HelpCircle,
  FileText, CalendarCheck, BarChart3, FolderTree
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useSocket } from "@/contexts/SocketContext";

interface NavItem { label: string; href: string; icon: any; badge?: number; }

function CustomerNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My Jobs", href: "/my-jobs", icon: Briefcase },
    { label: "Bookings", href: "/bookings", icon: ListChecks },
    { label: "Messages", href: "/chat", icon: MessageSquare },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Support", href: "/support", icon: HelpCircle },
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
    { label: "Notifications", href: "/pro/notifications", icon: Bell },
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
    { label: "Quotes", href: "/admin/quotes", icon: FileText },
    { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
    { label: "Reviews", href: "/admin/reviews", icon: Star },
    { label: "Chat Monitor", href: "/admin/chat", icon: MessageSquare },
    { label: "Payments", href: "/admin/payments", icon: CreditCard },
    { label: "Support", href: "/admin/support", icon: ShieldCheck },
    { label: "Analytics", href: "/admin/metrics", icon: BarChart3 },
    { label: "Audit Logs", href: "/admin/audit", icon: ListChecks },
    { label: "Feature Flags", href: "/admin/flags", icon: Zap },
  ];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handleNewNotif = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    };
    socket.on("new_notification", handleNewNotif);
    return () => {
      socket.off("new_notification", handleNewNotif);
    };
  }, [socket]);

  const { data: notifData } = useQuery<any>({ queryKey: ["/api/notifications"] });
  const { data: chatUnread } = useQuery<any>({ queryKey: ["/api/chat/unread-count"], refetchInterval: 15000 });
  const unreadCount = notifData?.unreadCount || 0;
  const unreadMessages = chatUnread?.count || 0;

  const navItems = user?.role === "ADMIN" ? AdminNav()
    : user?.role === "PROFESSIONAL" ? ProNav()
    : CustomerNav();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white/40 dark:bg-black/40 backdrop-blur-xl border-r border-white/20 dark:border-white/10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 dark:from-primary dark:to-indigo-400 font-outfit tracking-tight">ServiceConnect</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ease-out",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 translate-x-1"
                  : "text-foreground/70 hover:bg-white/60 dark:hover:bg-white/5 hover:text-foreground hover:translate-x-1"
              )}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.href.replace(/\//g, "-")}`}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-transform", isActive ? "scale-110" : "")} />
              <span className="flex-1">{item.label}</span>
              {item.label === "Notifications" && unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">{unreadCount}</Badge>
              )}
              {item.label === "Messages" && unreadMessages > 0 && (
                <Badge variant="destructive" className="text-xs h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">{unreadMessages}</Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-white/20 dark:border-white/10 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-primary/20 ring-offset-2 ring-offset-background/50 transition-all hover:ring-primary/50">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-indigo-500/20 text-primary font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate text-foreground">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-foreground/60 truncate">{user?.email}</div>
            </div>
          </div>
          {user?.role === "PROFESSIONAL" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold w-fit">
              <CreditCard className="w-3.5 h-3.5" />
              {user.creditBalance} credits
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 mt-1 text-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground overflow-hidden font-inter selection:bg-primary/20">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 flex-col flex-shrink-0 relative z-20">
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
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-white/60 dark:bg-black/60 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-sm">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-foreground/80" />
          </Button>
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 dark:from-primary dark:to-indigo-400 font-outfit tracking-tight">ServiceConnect</span>
          <div className="w-9" />
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] bg-[length:32px_32px] pointer-events-none" />
          <div className="relative p-4 md:p-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
