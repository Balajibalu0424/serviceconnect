import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ROLE_COLORS: Record<string, string> = { CUSTOMER: "secondary", PROFESSIONAL: "default", ADMIN: "destructive", SUPPORT: "outline" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "default", SUSPENDED: "secondary", BANNED: "destructive", PENDING: "outline" };

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); }
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Users <span className="text-muted-foreground text-base font-normal">({data?.total || 0})</span></h1>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by email or name..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All roles" /></SelectTrigger>
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                      <Badge variant={ROLE_COLORS[u.role] as any} className="text-xs">{u.role}</Badge>
                      <Badge variant={STATUS_COLORS[u.status] as any} className="text-xs">{u.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email} · Joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</p>
                    {u.role === "PROFESSIONAL" && <p className="text-xs text-muted-foreground">Credits: {u.creditBalance}</p>}
                  </div>
                  <div className="flex gap-2">
                    {u.status !== "SUSPENDED" && (
                      <Button size="sm" variant="outline" onClick={() => updateUser.mutate({ id: u.id, status: "SUSPENDED" })} data-testid={`button-suspend-${u.id}`}>Suspend</Button>
                    )}
                    {u.status === "SUSPENDED" && (
                      <Button size="sm" variant="outline" onClick={() => updateUser.mutate({ id: u.id, status: "ACTIVE" })} data-testid={`button-activate-${u.id}`}>Activate</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && <div className="text-center py-12 text-muted-foreground"><Users className="w-8 h-8 mx-auto mb-2 opacity-20" /><p>No users found</p></div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
