import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Users, CreditCard, ShieldCheck, ShieldX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ROLE_COLORS: Record<string, string> = { CUSTOMER: "secondary", PROFESSIONAL: "default", ADMIN: "destructive", SUPPORT: "outline" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "default", SUSPENDED: "secondary", BANNED: "destructive", PENDING: "outline" };

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Grant credits dialog
  const [grantTarget, setGrantTarget] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (roleFilter !== "all") queryParams.set("role", roleFilter);

  const { data } = useQuery<any>({ queryKey: [`/api/admin/users?${queryParams}`] });
  const users = data?.users || [];

  const updateUser = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, { status });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/users") });
      toast({ title: "User updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyPro = useMutation({
    mutationFn: async ({ id, approved, note }: { id: string; approved: boolean; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/verify`, { approved, note });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/users") });
      toast({ title: vars.approved ? "Pro verified" : "Verification rejected" });
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
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/users") });
      toast({ title: "Credits granted", description: `New balance: ${data?.newBalance} credits` });
      setGrantTarget(null);
      setGrantAmount("");
      setGrantReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Users <span className="text-muted-foreground text-base font-normal">({data?.total || 0})</span>
          </h1>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
              <SelectItem value="PROFESSIONAL">Professional</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {users.map((u: any) => (
            <Card key={u.id} data-testid={`user-${u.id}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                      <Badge variant={ROLE_COLORS[u.role] as any} className="text-xs">{u.role}</Badge>
                      <Badge variant={STATUS_COLORS[u.status] as any} className="text-xs">{u.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {u.email} · Joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                    </p>
                    {u.role === "PROFESSIONAL" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3" />
                        {u.creditBalance ?? 0} credits
                        {u.proVerification?.verificationStatus === "PENDING" && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">· Verification pending</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {u.role === "PROFESSIONAL" && u.proVerification && (
                      <>
                        {u.proVerification.verificationStatus === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30"
                              onClick={() => verifyPro.mutate({ id: u.id, approved: true })}
                              disabled={verifyPro.isPending}
                              data-testid={`button-approve-${u.id}`}
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/5"
                              onClick={() => verifyPro.mutate({ id: u.id, approved: false, note: "Documents not sufficient" })}
                              disabled={verifyPro.isPending}
                              data-testid={`button-reject-${u.id}`}
                            >
                              <ShieldX className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {u.proVerification.verificationStatus === "APPROVED" && (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {u.proVerification.verificationStatus === "UNSUBMITTED" && (
                          <span className="text-xs text-muted-foreground">Not submitted</span>
                        )}
                        {u.proVerification.verificationStatus === "REJECTED" && (
                          <span className="text-xs text-destructive flex items-center gap-1">
                            <ShieldX className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </>
                    )}
                    {u.role === "PROFESSIONAL" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary border-primary/30 hover:bg-primary/5"
                        onClick={() => setGrantTarget({ id: u.id, name: `${u.firstName} ${u.lastName}`, balance: u.creditBalance ?? 0 })}
                        data-testid={`button-grant-${u.id}`}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Grant Credits
                      </Button>
                    )}
                    {u.status !== "SUSPENDED" && u.role !== "ADMIN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateUser.mutate({ id: u.id, status: "SUSPENDED" })}
                        data-testid={`button-suspend-${u.id}`}
                      >
                        Suspend
                      </Button>
                    )}
                    {u.status === "SUSPENDED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateUser.mutate({ id: u.id, status: "ACTIVE" })}
                        data-testid={`button-activate-${u.id}`}
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Grant Credits Dialog */}
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
                onChange={e => setGrantAmount(e.target.value)}
                data-testid="input-grant-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Compensation for technical issue"
                value={grantReason}
                onChange={e => setGrantReason(e.target.value)}
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
              {grantCredits.isPending ? "Granting…" : `Grant ${grantAmount || "0"} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
