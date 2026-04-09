import { Switch, Route, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { CallProvider } from "@/contexts/CallContext";
import { CallOverlay } from "@/components/CallOverlay";
import AiAssistantWidget from "@/components/ai/AiAssistantWidget";


// Public pages
import Home from "@/pages/public/Home";
import Login from "@/pages/public/Login";
import Register from "@/pages/public/Register";
import RegisterCustomer from "@/pages/public/RegisterCustomer";
import AdminLogin from "@/pages/public/AdminLogin";
import Services from "@/pages/public/Services";
import ProOnboarding from "@/pages/public/ProOnboarding";
import ProPublicProfile from "@/pages/public/ProProfile";

// Customer pages
import CustomerDashboard from "@/pages/customer/Dashboard";
import CustomerMyJobs from "@/pages/customer/MyJobs";
import CustomerJobDetail from "@/pages/customer/JobDetail";
import CustomerBookings from "@/pages/customer/Bookings";
import CustomerChat from "@/pages/customer/Chat";
import CustomerNotifications from "@/pages/customer/Notifications";
import CustomerSettings from "@/pages/customer/Settings";
import CustomerSupport from "@/pages/customer/Support";
import PostJob from "@/pages/customer/PostJob";

// Professional pages
import ProDashboard from "@/pages/pro/Dashboard";
import ProJobFeed from "@/pages/pro/JobFeed";
import ProMatchbooked from "@/pages/pro/Matchbooked";
import ProLeads from "@/pages/pro/Leads";
import ProBookings from "@/pages/pro/Bookings";
import ProChat from "@/pages/pro/Chat";
import ProProfile from "@/pages/pro/ProfileEditor";
import ProCredits from "@/pages/pro/Credits";
import ProSpinWheel from "@/pages/pro/SpinWheel";
import ProVerificationPending from "@/pages/pro/VerificationPending";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminJobs from "@/pages/admin/Jobs";
import AdminQuotes from "@/pages/admin/Quotes";
import AdminBookings from "@/pages/admin/Bookings";
import AdminReviews from "@/pages/admin/Reviews";
import AdminChatMonitor from "@/pages/admin/ChatMonitor";
import AdminPayments from "@/pages/admin/Payments";
import AdminSupport from "@/pages/admin/Support";
import AdminAuditLogs from "@/pages/admin/AuditLogs";
import AdminFeatureFlags from "@/pages/admin/FeatureFlags";
import AdminMetrics from "@/pages/admin/Metrics";
import AdminJobDetail from "@/pages/admin/JobDetail";

function ProtectedRoute({ children, roles, requireVerified = false }: { children: React.ReactNode; roles?: string[]; requireVerified?: boolean }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Redirect to="/" />;
  // Gate pro routes behind verification
  if (requireVerified && user?.role === "PROFESSIONAL") {
    const isVerified = user.profile?.isVerified === true;
    if (!isVerified) return <Redirect to="/pro/verification-pending" />;
  }
  return <>{children}</>;
}

// Unauthenticated users hitting /post-job get routed into the customer onboarding flow
function PostJobRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>;
  if (!isAuthenticated) return <Redirect to="/register?role=CUSTOMER" />;
  return <PostJob />;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/register/customer" component={RegisterCustomer} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/services" component={Services} />
      <Route path="/post-job" component={PostJobRoute} />
      <Route path="/pro/onboarding" component={ProOnboarding} />
      <Route path="/pro/:id/profile" component={ProPublicProfile} />

      {/* Customer */}
      <Route path="/dashboard">
        <ProtectedRoute roles={["CUSTOMER"]}><CustomerDashboard /></ProtectedRoute>
      </Route>
      <Route path="/my-jobs">
        <ProtectedRoute roles={["CUSTOMER"]}><CustomerMyJobs /></ProtectedRoute>
      </Route>
      <Route path="/jobs/:id">
        <ProtectedRoute roles={["CUSTOMER"]}><CustomerJobDetail /></ProtectedRoute>
      </Route>
      <Route path="/bookings">
        <ProtectedRoute><CustomerBookings /></ProtectedRoute>
      </Route>
      <Route path="/chat">
        <ProtectedRoute><CustomerChat /></ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute><CustomerNotifications /></ProtectedRoute>
      </Route>
      <Route path="/support">
        <ProtectedRoute><CustomerSupport /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><CustomerSettings /></ProtectedRoute>
      </Route>

      {/* Professional — verification pending/submit (no requireVerified so unverified pros can reach it) */}
      <Route path="/pro/verification-pending">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProVerificationPending /></ProtectedRoute>
      </Route>

      {/* Professional — all routes accessible without verification */}
      <Route path="/pro/dashboard">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProDashboard /></ProtectedRoute>
      </Route>
      <Route path="/pro/feed">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProJobFeed /></ProtectedRoute>
      </Route>
      <Route path="/pro/matchbooked">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProMatchbooked /></ProtectedRoute>
      </Route>
      <Route path="/pro/leads">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProLeads /></ProtectedRoute>
      </Route>
      <Route path="/pro/bookings">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProBookings /></ProtectedRoute>
      </Route>
      <Route path="/pro/chat">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProChat /></ProtectedRoute>
      </Route>
      <Route path="/pro/profile">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProProfile /></ProtectedRoute>
      </Route>
      <Route path="/pro/credits">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProCredits /></ProtectedRoute>
      </Route>
      <Route path="/pro/spin">
        <ProtectedRoute roles={["PROFESSIONAL"]}><ProSpinWheel /></ProtectedRoute>
      </Route>

      {/* Admin */}
      <Route path="/admin">
        <ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute roles={["ADMIN"]}><AdminUsers /></ProtectedRoute>
      </Route>
      <Route path="/admin/jobs">
        <ProtectedRoute roles={["ADMIN"]}><AdminJobs /></ProtectedRoute>
      </Route>
      <Route path="/admin/jobs/:id">
        <ProtectedRoute roles={["ADMIN"]}><AdminJobDetail /></ProtectedRoute>
      </Route>
      <Route path="/admin/quotes">
        <ProtectedRoute roles={["ADMIN"]}><AdminQuotes /></ProtectedRoute>
      </Route>
      <Route path="/admin/bookings">
        <ProtectedRoute roles={["ADMIN"]}><AdminBookings /></ProtectedRoute>
      </Route>
      <Route path="/admin/reviews">
        <ProtectedRoute roles={["ADMIN"]}><AdminReviews /></ProtectedRoute>
      </Route>
      <Route path="/admin/chat">
        <ProtectedRoute roles={["ADMIN"]}><AdminChatMonitor /></ProtectedRoute>
      </Route>
      <Route path="/admin/payments">
        <ProtectedRoute roles={["ADMIN"]}><AdminPayments /></ProtectedRoute>
      </Route>
      <Route path="/admin/support">
        <ProtectedRoute roles={["ADMIN"]}><AdminSupport /></ProtectedRoute>
      </Route>
      <Route path="/admin/audit">
        <ProtectedRoute roles={["ADMIN"]}><AdminAuditLogs /></ProtectedRoute>
      </Route>
      <Route path="/admin/flags">
        <ProtectedRoute roles={["ADMIN"]}><AdminFeatureFlags /></ProtectedRoute>
      </Route>
      <Route path="/admin/metrics">
        <ProtectedRoute roles={["ADMIN"]}><AdminMetrics /></ProtectedRoute>
      </Route>

      <Route>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-muted-foreground mb-4">Page not found</p>
            <a href="/" className="text-primary hover:underline">Go home</a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <AppRoutes />
            <CallOverlay />
            <AiAssistantWidget />
            <Toaster />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
