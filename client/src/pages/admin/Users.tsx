import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Users, CreditCard, ShieldCheck, ShieldX, ChevronLeft, ChevronRight,
  Loader2, Inbox, Pencil, Ban, CheckCircle, Clock, Mail, Phone, Calendar,
  Briefcase, MessageSquare, Star, History, Coins, AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProVerification {
  isVerified: boolean;
  verificationStatus: "UNSUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
  verificationDocumentUrl?: string;
  verificationSubmittedAt?: string;
  verificationReviewNote?: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: "CUSTOMER" | "PROFESSIONAL" | "ADMIN" | "SUPPORT";
  status: "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING";
  creditBalance?: number;
  createdAt: string;
  proVerification?: ProVerification;
}

interface UsersResponse {
  users: User[];
  total: number;
}

interface UserDetail {
  user: User;
  profile: any;
  jobs: any[];
  quotes: any[];
  bookings: any[];
  reviewsGiven: any[];
  reviewsReceived: any[];
  creditTransactions: any[];
  auditTrail: any[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const GLASS = "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl";

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  CUSTOMER:     { label: "Customer",     color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  PROFESSIONAL: { label: "Professional", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  ADMIN:        { label: "Admin",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  SUPPORT:      { label: "Support",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: "Active",    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  SUSPENDED: { label: "Suspended", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  BANNED:    { label: "Banned",    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  PENDING:   { label: "Pending",   color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Filters & pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Grant credits dialog
  const [grantTarget, setGrantTarget] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");

  // Name edit dialog
  const [nameEditTarget, setNameEditTarget] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editNameReason, setEditNameReason] = useState("");

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [verificationRejectTarget, setVerificationRejectTarget] = useState<User | null>(null);
  const [verificationRejectNote, setVerificationRejectNote] = useState("");

  // Detail sheet
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (roleFilter !== "all") params.set("role", roleFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: [`/api/admin/users?${params}`],
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { data: userDetail, isLoading: detailLoading } = useQuery<UserDetail>({
    queryKey: [`/api/admin/users/${detailUserId}/detail`],
    enabled: !!detailUserId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidateUsers = () => {
    qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/users") });
  };

  const updateUser = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status?: string; role?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, body);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => { invalidateUsers(); toast({ title: "User updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const suspendUser = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/suspend`, { reason });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      invalidateUsers();
      toast({ title: "User suspended" });
      setSuspendTarget(null);
      setSuspendReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unsuspendUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/unsuspend`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => { invalidateUsers(); toast({ title: "User activated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyPro = useMutation({
    mutationFn: async ({ id, approved, note }: { id: string; approved: boolean; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/verify`, { approved, note });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_, vars) => {
      invalidateUsers();
      toast({ title: vars.approved ? "Pro verified" : "Verification rejected" });
      setVerificationRejectTarget(null);
      setVerificationRejectNote("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grantCredits = useMutation({
    mutationFn: async () => {
      if (!grantTarget) return;
      const res = await apiRequest("POST", "/api/admin/credits/grant", {
        userId: grantTarget.id,
        amount: parseInt(grantAmount),
        reason: grantReason || "Admin grant",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateUsers();
      toast({ title: "Credits granted", description: `New balance: ${data?.newBalance} credits` });
      setGrantTarget(null);
      setGrantAmount("");
      setGrantReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editName = useMutation({
    mutationFn: async () => {
      if (!nameEditTarget) return;
      const res = await apiRequest("PATCH", `/api/admin/users/${nameEditTarget.id}/name`, {
        firstName: editFirstName,
        lastName: editLastName,
        reason: editNameReason || "Admin name edit",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      invalidateUsers();
      toast({ title: "Name updated" });
      setNameEditTarget(null);
      setEditFirstName("");
      setEditLastName("");
      setEditNameReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function openNameEdit(user: User) {
    setNameEditTarget(user);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditNameReason("");
  }

  function renderVerificationBadge(user: User) {
    const v = user.proVerification;
    if (!v || user.role !== "PROFESSIONAL") return null;
    switch (v.verificationStatus) {
      case "PENDING":
        return (
          <Badge className="text-[10px] bg-amber-500 text-white border-0 gap-0.5 animate-pulse">
            <AlertTriangle className="w-2.5 h-2.5" /> Verification Pending
          </Badge>
        );
      case "APPROVED":
        return (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        );
      case "REJECTED":
        return (
          <span className="text-xs text-destructive flex items-center gap-1">
            <ShieldX className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">Not submitted</span>;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              User Management
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-mono">
                {total}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Search, verify, suspend, and manage all platform users</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className={cn(GLASS, "p-4 shadow-sm")}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 rounded-xl border-border/60 focus:border-primary focus:ring-primary/20"
                data-testid="input-search"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPPORT">Support</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="BANNED">Banned</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={cn(GLASS, "p-5 animate-pulse")}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-72 bg-muted rounded" />
                  </div>
                  <div className="h-8 w-20 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className={cn(GLASS, "shadow-sm")}>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold font-outfit mb-1">No users found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {search ? "Try adjusting your search terms or filters." : "No users have been registered yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const roleConf = ROLE_CONFIG[u.role] || { label: u.role, color: "" };
              const statusConf = STATUS_CONFIG[u.status] || { label: u.status, color: "" };
              return (
                <div
                  key={u.id}
                  data-testid={`user-${u.id}`}
                  className={cn(GLASS, "p-4 md:p-5 hover:shadow-md transition-all duration-200 group")}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <button
                          className="font-semibold text-sm truncate group-hover:text-primary transition-colors hover:underline cursor-pointer text-left"
                          onClick={() => setDetailUserId(u.id)}
                        >
                          {u.firstName} {u.lastName}
                        </button>
                        <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", roleConf.color)}>
                          {roleConf.label}
                        </Badge>
                        <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", statusConf.color)}>
                          {statusConf.label}
                        </Badge>
                        {renderVerificationBadge(u)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {u.email}
                        </span>
                        {u.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {u.phone}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive">
                            <Phone className="w-3 h-3" /> No phone
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                        </span>
                        {u.role === "PROFESSIONAL" && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> {u.creditBalance ?? 0} credits
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {/* Edit Name */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 rounded-xl text-muted-foreground hover:text-foreground"
                        onClick={() => openNameEdit(u)}
                        data-testid={`button-edit-name-${u.id}`}
                      >
                        <Pencil className="w-3 h-3" /> Edit Name
                      </Button>

                      {/* Verification actions for pending pros */}
                      {u.role === "PROFESSIONAL" && u.proVerification?.verificationStatus === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
                            onClick={() => verifyPro.mutate({ id: u.id, approved: true })}
                            disabled={verifyPro.isPending}
                            data-testid={`button-approve-${u.id}`}
                          >
                            <ShieldCheck className="w-3 h-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => {
                              setVerificationRejectTarget(u);
                              setVerificationRejectNote(u.proVerification?.verificationReviewNote || "");
                            }}
                            disabled={verifyPro.isPending}
                            data-testid={`button-reject-${u.id}`}
                          >
                            <ShieldX className="w-3 h-3" /> Reject
                          </Button>
                        </>
                      )}

                      {/* Grant Credits for pros */}
                      {u.role === "PROFESSIONAL" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 rounded-xl text-primary border-primary/30 hover:bg-primary/5"
                          onClick={() => setGrantTarget({ id: u.id, name: `${u.firstName} ${u.lastName}`, balance: u.creditBalance ?? 0 })}
                          data-testid={`button-grant-${u.id}`}
                        >
                          <CreditCard className="w-3 h-3" /> Grant Credits
                        </Button>
                      )}

                      {/* Suspend / Activate */}
                      {u.status !== "SUSPENDED" && u.role !== "ADMIN" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setSuspendTarget(u)}
                          data-testid={`button-suspend-${u.id}`}
                        >
                          <Ban className="w-3 h-3" /> Suspend
                        </Button>
                      )}
                      {u.status === "SUSPENDED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 rounded-xl text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30"
                          onClick={() => unsuspendUser.mutate(u.id)}
                          disabled={unsuspendUser.isPending}
                          data-testid={`button-activate-${u.id}`}
                        >
                          <CheckCircle className="w-3 h-3" /> Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} users
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Grant Credits Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!grantTarget} onOpenChange={() => setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits to {grantTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Current balance: <span className="font-semibold text-foreground">{grantTarget?.balance ?? 0} credits</span>
            </p>
            <div className="space-y-1.5">
              <Label>Amount to grant</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                data-testid="input-grant-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Compensation for technical issue"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                rows={2}
                data-testid="input-grant-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>Cancel</Button>
            <Button
              onClick={() => grantCredits.mutate()}
              disabled={!grantAmount || parseInt(grantAmount) < 1 || grantCredits.isPending}
              data-testid="button-confirm-grant"
            >
              {grantCredits.isPending ? "Granting..." : `Grant ${grantAmount || "0"} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Name Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!nameEditTarget} onOpenChange={() => setNameEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Editing name for <span className="font-semibold text-foreground">{nameEditTarget?.email}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                  data-testid="input-edit-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason for change (audit trail)</Label>
              <Textarea
                placeholder="e.g. User requested legal name correction"
                value={editNameReason}
                onChange={(e) => setEditNameReason(e.target.value)}
                rows={2}
                data-testid="input-edit-name-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameEditTarget(null)}>Cancel</Button>
            <Button
              onClick={() => editName.mutate()}
              disabled={!editFirstName.trim() || !editLastName.trim() || editName.isPending}
              data-testid="button-confirm-edit-name"
            >
              {editName.isPending ? "Saving..." : "Save Name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suspend Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Suspending <span className="font-semibold text-foreground">{suspendTarget?.firstName} {suspendTarget?.lastName}</span> ({suspendTarget?.email}).
              They will not be able to access the platform until reactivated.
            </p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Violation of terms of service"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={2}
                data-testid="input-suspend-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => suspendTarget && suspendUser.mutate({ id: suspendTarget.id, reason: suspendReason })}
              disabled={suspendUser.isPending}
              data-testid="button-confirm-suspend"
            >
              {suspendUser.isPending ? "Suspending..." : "Confirm Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── User Detail Sheet ─────────────────────────────────────────────── */}
      <Dialog open={!!verificationRejectTarget} onOpenChange={() => setVerificationRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Add a review note for <span className="font-semibold text-foreground">{verificationRejectTarget?.firstName} {verificationRejectTarget?.lastName}</span> so they know what to correct before resubmitting.
            </p>
            <div className="space-y-1.5">
              <Label>Review note</Label>
              <Textarea
                placeholder="e.g. The uploaded licence is expired or the document is unreadable."
                value={verificationRejectNote}
                onChange={(e) => setVerificationRejectNote(e.target.value)}
                rows={3}
                data-testid="input-verification-reject-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerificationRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() =>
                verificationRejectTarget &&
                verifyPro.mutate({
                  id: verificationRejectTarget.id,
                  approved: false,
                  note: verificationRejectNote.trim() || "Verification documents were not sufficient.",
                })
              }
              disabled={verifyPro.isPending}
              data-testid="button-confirm-verification-reject"
            >
              {verifyPro.isPending ? "Rejecting..." : "Reject Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detailUserId} onOpenChange={() => setDetailUserId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>User Details</SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : userDetail ? (
            <div className="mt-4 space-y-6">
              {/* User info header */}
              <div className={cn(GLASS, "p-4 space-y-3")}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                    {userDetail.user.firstName?.[0]}{userDetail.user.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base">
                      {userDetail.user.firstName} {userDetail.user.lastName}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", ROLE_CONFIG[userDetail.user.role]?.color)}>
                        {ROLE_CONFIG[userDetail.user.role]?.label}
                      </Badge>
                      <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", STATUS_CONFIG[userDetail.user.status]?.color)}>
                        {STATUS_CONFIG[userDetail.user.status]?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {userDetail.user.email}</span>
                  <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {userDetail.user.phone || "No phone"}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Joined {format(new Date(userDetail.user.createdAt), "MMM d, yyyy")}</span>
                  {userDetail.user.role === "PROFESSIONAL" && (
                    <span className="flex items-center gap-1.5"><Coins className="w-3 h-3" /> {userDetail.user.creditBalance ?? 0} credits</span>
                  )}
                </div>
              </div>

              {userDetail.user.role === "PROFESSIONAL" && (
                <div className={cn(GLASS, "p-4 space-y-3")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm">Verification review</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {userDetail.profile?.verificationStatus || "UNSUBMITTED"}
                      </p>
                    </div>
                    {userDetail.profile?.verificationStatus === "APPROVED" ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Approved</Badge>
                    ) : userDetail.profile?.verificationStatus === "PENDING" ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pending review</Badge>
                    ) : userDetail.profile?.verificationStatus === "REJECTED" ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Rejected</Badge>
                    ) : (
                      <Badge variant="outline">Unsubmitted</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Submitted:</span>{" "}
                      {userDetail.profile?.verificationSubmittedAt
                        ? format(new Date(userDetail.profile.verificationSubmittedAt), "MMM d, yyyy HH:mm")
                        : "Not submitted"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Reviewed:</span>{" "}
                      {userDetail.profile?.verificationReviewedAt
                        ? format(new Date(userDetail.profile.verificationReviewedAt), "MMM d, yyyy HH:mm")
                        : "Not reviewed"}
                    </div>
                  </div>

                  {userDetail.profile?.verificationDocumentUrl && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="outline" size="sm" asChild>
                        <a href={userDetail.profile.verificationDocumentUrl} target="_blank" rel="noreferrer">
                          Open verification document
                        </a>
                      </Button>
                      {userDetail.profile?.licenseNumber && (
                        <span className="text-xs text-muted-foreground">
                          Licence: <span className="font-medium text-foreground">{userDetail.profile.licenseNumber}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {userDetail.profile?.verificationReviewNote && (
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-1">Latest review note</p>
                      <p className="text-muted-foreground">{userDetail.profile.verificationReviewNote}</p>
                    </div>
                  )}

                  {userDetail.profile?.verificationStatus === "PENDING" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => verifyPro.mutate({ id: userDetail.user.id, approved: true })}
                        disabled={verifyPro.isPending}
                      >
                        <ShieldCheck className="w-3 h-3" /> Approve verification
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => {
                          setVerificationRejectTarget(userDetail.user);
                          setVerificationRejectNote(userDetail.profile?.verificationReviewNote || "");
                        }}
                        disabled={verifyPro.isPending}
                      >
                        <ShieldX className="w-3 h-3" /> Reject with note
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <Tabs defaultValue="activity" className="w-full">
                <TabsList className="w-full grid grid-cols-7 h-9">
                  <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
                  <TabsTrigger value="jobs" className="text-xs">Jobs</TabsTrigger>
                  <TabsTrigger value="quotes" className="text-xs">Quotes</TabsTrigger>
                  <TabsTrigger value="bookings" className="text-xs">Bookings</TabsTrigger>
                  <TabsTrigger value="reviews" className="text-xs">Reviews</TabsTrigger>
                  <TabsTrigger value="credits" className="text-xs">Credits</TabsTrigger>
                  <TabsTrigger value="audit" className="text-xs">Audit</TabsTrigger>
                </TabsList>

                {/* Activity Tab */}
                <TabsContent value="activity" className="mt-4 space-y-3">
                  {(() => {
                    const timeline = [
                      ...(userDetail.jobs || []).map((j: any) => ({ type: "job", date: j.createdAt, label: `Posted job: ${j.title}`, status: j.status })),
                      ...(userDetail.quotes || []).map((q: any) => ({ type: "quote", date: q.createdAt, label: `Quote: ${q.amount ? `$${q.amount}` : "N/A"}`, status: q.status })),
                      ...(userDetail.bookings || []).map((b: any) => ({ type: "booking", date: b.createdAt, label: `Booking #${b.id}`, status: b.status })),
                      ...(userDetail.reviewsGiven || []).map((r: any) => ({ type: "review", date: r.createdAt, label: `Gave ${r.rating}-star review` })),
                      ...(userDetail.reviewsReceived || []).map((r: any) => ({ type: "review", date: r.createdAt, label: `Received ${r.rating}-star review` })),
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

                    if (timeline.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>;
                    return timeline.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                            {(item as any).status && <> &middot; <Badge variant="outline" className="text-[10px] ml-1">{(item as any).status}</Badge></>}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </TabsContent>

                {/* Jobs Tab */}
                <TabsContent value="jobs" className="mt-4 space-y-2">
                  {(userDetail.jobs || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No jobs</p>
                  ) : (userDetail.jobs || []).map((j: any) => (
                    <div key={j.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{j.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{j.status}</Badge>
                    </div>
                  ))}
                </TabsContent>

                {/* Quotes Tab */}
                <TabsContent value="quotes" className="mt-4 space-y-2">
                  {(userDetail.quotes || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No quotes</p>
                  ) : (userDetail.quotes || []).map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{q.amount ? `$${q.amount}` : "No amount"}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.jobTitle && <>{q.jobTitle} &middot; </>}
                          {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{q.status}</Badge>
                    </div>
                  ))}
                </TabsContent>

                {/* Bookings Tab */}
                <TabsContent value="bookings" className="mt-4 space-y-2">
                  {(userDetail.bookings || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No bookings</p>
                  ) : (userDetail.bookings || []).map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Booking #{b.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.amount ? `$${b.amount}` : ""}{b.amount && b.createdAt ? " \u00B7 " : ""}
                          {b.createdAt && formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{b.status}</Badge>
                    </div>
                  ))}
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews" className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reviews Given</h4>
                    {(userDetail.reviewsGiven || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">None</p>
                    ) : (userDetail.reviewsGiven || []).map((r: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/30 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star key={s} className={cn("w-3 h-3", s < r.rating ? "text-amber-500 fill-amber-500" : "text-muted")} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{r.createdAt && formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                        </div>
                        {r.comment && <p className="text-xs">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reviews Received</h4>
                    {(userDetail.reviewsReceived || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">None</p>
                    ) : (userDetail.reviewsReceived || []).map((r: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/30 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star key={s} className={cn("w-3 h-3", s < r.rating ? "text-amber-500 fill-amber-500" : "text-muted")} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{r.createdAt && formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                        </div>
                        {r.comment && <p className="text-xs">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Credits Tab */}
                <TabsContent value="credits" className="mt-4 space-y-2">
                  {(userDetail.creditTransactions || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No credit transactions</p>
                  ) : (userDetail.creditTransactions || []).map((tx: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{tx.description || tx.type || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">{tx.createdAt && formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}</p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular-nums", tx.amount > 0 ? "text-green-600" : "text-red-500")}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </span>
                    </div>
                  ))}
                </TabsContent>

                {/* Audit Tab */}
                <TabsContent value="audit" className="mt-4 space-y-2">
                  {(userDetail.auditTrail || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No audit records</p>
                  ) : (userDetail.auditTrail || []).map((entry: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <History className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm">{entry.action || entry.description || "Action performed"}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.performedBy && <>{entry.performedBy} &middot; </>}
                          {entry.createdAt && formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </p>
                        {entry.details && <p className="text-xs text-muted-foreground mt-1">{typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details)}</p>}
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Unable to load user details</p>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
