import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, ArrowLeft, Send, Loader2, AlertTriangle, Clock, User,
  Star, TrendingUp, MessageSquare, Plus, Trash2, Edit2, Save,
  ChevronUp, BookOpen, Zap, Eye, EyeOff, BarChart3, X,
  ThumbsUp, ThumbsDown
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "secondary", MEDIUM: "outline", HIGH: "default", URGENT: "destructive",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "default", IN_PROGRESS: "secondary", WAITING: "outline", RESOLVED: "secondary", CLOSED: "destructive",
};
const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General", BILLING: "Billing", JOB: "Job", PROFESSIONAL: "Pro",
  TECHNICAL: "Technical", SAFETY: "Safety", ACCOUNT: "Account"
};

// ─── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/support/analytics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/support/analytics");
      return res.json();
    },
    refetchInterval: 30000
  });

  if (!stats) return <div className="p-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="text-2xl font-bold">{stats.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={cn("text-2xl font-bold", stats.overdue > 0 && "text-red-500")}>{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Waiting</p>
            <p className="text-2xl font-bold">{stats.waiting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Avg. Satisfaction</p>
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{stats.avgSatisfaction ? stats.avgSatisfaction.toFixed(1) : "-"}</p>
              {stats.avgSatisfaction && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-lg font-semibold">{stats.last7Days.created}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resolved</p>
              <p className="text-lg font-semibold text-green-600">{stats.last7Days.resolved}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{stats.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By category + priority */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.byCategory?.map((c: any) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{CATEGORY_LABELS[c.category] || c.category}</span>
                  <Badge variant="outline">{c.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">By Priority</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.byPriority?.map((p: any) => (
                <div key={p.priority} className="flex items-center justify-between text-sm">
                  <Badge variant={PRIORITY_COLORS[p.priority] as any}>{p.priority}</Badge>
                  <span>{p.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Canned Responses Manager ─────────────────────────────────────────────────
function CannedResponsesManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [shortcut, setShortcut] = useState("");

  const { data: responses = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/support/canned-responses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/support/canned-responses");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/admin/support/canned-responses/${editingId}` : "/api/admin/support/canned-responses";
      const res = await apiRequest(method, url, { title, content, category, shortcut: shortcut || null });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support/canned-responses"] });
      toast({ title: editingId ? "Response updated" : "Response created" });
      resetForm();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/support/canned-responses/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support/canned-responses"] });
      toast({ title: "Response deleted" });
    }
  });

  function resetForm() {
    setShowForm(false); setEditingId(null);
    setTitle(""); setContent(""); setCategory("GENERAL"); setShortcut("");
  }

  function startEdit(r: any) {
    setEditingId(r.id); setTitle(r.title); setContent(r.content);
    setCategory(r.category); setShortcut(r.shortcut || ""); setShowForm(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Canned Responses</h2>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> New Response
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Billing refund process" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Shortcut</Label>
                  <Input value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="/refund" className="h-8 text-sm" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Response template text..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!title.trim() || !content.trim() || saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {editingId ? "Update" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(responses as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No canned responses yet. Create one to speed up replies.</p>
        ) : (
          (responses as any[]).map((r: any) => (
            <Card key={r.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                      {r.shortcut && <code className="text-[10px] bg-muted px-1 rounded">{r.shortcut}</code>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Used {r.usageCount} times</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── FAQ Manager ──────────────────────────────────────────────────────────────
function FaqManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [isPublished, setIsPublished] = useState(true);

  const { data: articles = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/support/faq"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/support/faq");
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/admin/support/faq/${editingId}` : "/api/admin/support/faq";
      const res = await apiRequest(method, url, { question, answer, category, isPublished });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support/faq"] });
      toast({ title: editingId ? "Article updated" : "Article created" });
      resetForm();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/support/faq/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support/faq"] });
      toast({ title: "Article deleted" });
    }
  });

  function resetForm() {
    setShowForm(false); setEditingId(null);
    setQuestion(""); setAnswer(""); setCategory("GENERAL"); setIsPublished(true);
  }

  function startEdit(a: any) {
    setEditingId(a.id); setQuestion(a.question); setAnswer(a.answer);
    setCategory(a.category); setIsPublished(a.isPublished); setShowForm(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">FAQ Articles</h2>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> New Article
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label className="text-xs">{isPublished ? "Published" : "Draft"}</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Question</Label>
              <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="How do I...?" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Answer</Label>
              <Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} placeholder="Detailed answer..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!question.trim() || !answer.trim() || saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {editingId ? "Update" : "Publish"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(articles as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No FAQ articles yet.</p>
        ) : (
          (articles as any[]).map((a: any) => (
            <Card key={a.id} className={cn(!a.isPublished && "opacity-60")}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.isPublished ? <Eye className="w-3 h-3 text-green-500" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      <p className="font-medium text-sm">{a.question}</p>
                      <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 ml-5">{a.answer}</p>
                    <div className="flex items-center gap-3 ml-5 mt-1">
                      <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                        <ThumbsUp className="w-2.5 h-2.5" /> {a.helpfulCount}
                      </span>
                      <span className="text-[10px] text-red-500 flex items-center gap-0.5">
                        <ThumbsDown className="w-2.5 h-2.5" /> {a.notHelpfulCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Admin Support Page ──────────────────────────────────────────────────
export default function AdminSupport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCannedPicker, setShowCannedPicker] = useState(false);

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"],
    refetchInterval: 10000,
  });

  const { data: ticketDetail } = useQuery<any>({
    queryKey: ["/api/support/tickets", activeTicket?.id, "detail"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/support/tickets/${activeTicket.id}`);
      return res.json();
    },
    enabled: !!activeTicket,
    refetchInterval: 8000,
  });

  const { data: cannedResponses = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/support/canned-responses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/support/canned-responses");
      return res.json();
    }
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${activeTicket.id}/messages`, {
        message: reply, isInternal: isInternalNote
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket?.id, "detail"] });
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setReply(""); setIsInternalNote(false);
      toast({ title: isInternalNote ? "Internal note added" : "Reply sent" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/support/tickets/${activeTicket.id}`, { status });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      qc.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket?.id, "detail"] });
      setActiveTicket(data);
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${activeTicket.id}/escalate`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      qc.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket?.id, "detail"] });
      setActiveTicket(data);
      toast({ title: "Ticket escalated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function useCannedResponse(r: any) {
    setReply(r.content);
    setShowCannedPicker(false);
    // Track usage
    apiRequest("POST", `/api/admin/support/canned-responses/${r.id}/use`);
  }

  // Filter tickets
  let filteredTickets = tickets as any[];
  if (statusFilter !== "all") filteredTickets = filteredTickets.filter(t => t.status === statusFilter);
  if (priorityFilter !== "all") filteredTickets = filteredTickets.filter(t => t.priority === priorityFilter);
  // Sort: overdue first, then by priority weight, then by date
  const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  filteredTickets.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const detail = ticketDetail || activeTicket;

  return (
    <DashboardLayout>
      <Tabs defaultValue="tickets" className="h-[calc(100vh-4rem)]">
        <div className="border-b px-4 pt-2">
          <TabsList className="h-9">
            <TabsTrigger value="tickets" className="gap-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5" /> Tickets
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="canned" className="gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5" /> Canned Responses
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> FAQ Manager
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="mt-0 overflow-y-auto" style={{ height: "calc(100vh - 7rem)" }}>
          <AnalyticsPanel />
        </TabsContent>

        <TabsContent value="canned" className="mt-0 overflow-y-auto" style={{ height: "calc(100vh - 7rem)" }}>
          <CannedResponsesManager />
        </TabsContent>

        <TabsContent value="faq" className="mt-0 overflow-y-auto" style={{ height: "calc(100vh - 7rem)" }}>
          <FaqManager />
        </TabsContent>

        <TabsContent value="tickets" className="mt-0">
          <div className="flex" style={{ height: "calc(100vh - 7rem)" }}>
            {/* Ticket List */}
            <div className={cn(
              "w-full md:w-96 flex-shrink-0 border-r flex flex-col",
              activeTicket && "hidden md:flex"
            )}>
              <div className="p-3 border-b space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm">Tickets</h2>
                  <Badge variant="outline" className="text-xs">{filteredTickets.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="WAITING">Waiting</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                    <ShieldCheck className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">No tickets match filters</p>
                  </div>
                ) : (
                  filteredTickets.map((t: any) => (
                    <button key={t.id}
                      onClick={() => setActiveTicket(t)}
                      className={cn(
                        "w-full text-left p-3 border-b hover:bg-accent/50 transition-colors",
                        activeTicket?.id === t.id && "bg-accent",
                        t.isOverdue && "border-l-2 border-l-red-500"
                      )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{t.subject}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <User className="w-2.5 h-2.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{t.userName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end shrink-0">
                          <Badge variant={PRIORITY_COLORS[t.priority] as any} className="text-[10px]">{t.priority}</Badge>
                          <Badge variant={STATUS_COLORS[t.status] as any} className="text-[10px]">{t.status}</Badge>
                          {t.isOverdue && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                              <AlertTriangle className="w-2.5 h-2.5" /> SLA
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Ticket Detail */}
            <div className={cn(
              "flex-1 flex flex-col bg-background",
              !activeTicket && "hidden md:flex items-center justify-center"
            )}>
              {!activeTicket ? (
                <div className="text-center text-muted-foreground">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Select a ticket to view</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="p-4 border-b space-y-3">
                    <div className="flex items-center gap-3">
                      <button className="md:hidden" onClick={() => setActiveTicket(null)}>
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{detail?.subject}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={PRIORITY_COLORS[detail?.priority] as any} className="text-xs">
                            {detail?.priority}
                          </Badge>
                          <Badge variant={STATUS_COLORS[detail?.status] as any} className="text-xs">
                            {detail?.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[detail?.category] || detail?.category}
                          </Badge>
                          {detail?.isOverdue && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" /> SLA Breached
                            </Badge>
                          )}
                          {detail?.satisfactionRating && (
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-3 h-3 ${s <= detail.satisfactionRating
                                  ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                          onClick={() => escalateMutation.mutate()}
                          disabled={detail?.priority === "URGENT" || escalateMutation.isPending}>
                          <ChevronUp className="w-3 h-3" /> Escalate
                        </Button>
                        <Select value={detail?.status} onValueChange={s => updateStatus.mutate(s)}>
                          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="WAITING">Waiting</SelectItem>
                            <SelectItem value="RESOLVED">Resolved</SelectItem>
                            <SelectItem value="CLOSED">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Customer info + SLA */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {detail?.userName} ({detail?.userRole})
                      </span>
                      {detail?.userEmail && <span>{detail.userEmail}</span>}
                      {detail?.assigneeName && <span>Assigned to: <strong>{detail.assigneeName}</strong></span>}
                      {detail?.slaDeadline && (
                        <span className={cn(detail.isOverdue && "text-red-500 font-medium")}>
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          SLA: {format(new Date(detail.slaDeadline), "MMM d, HH:mm")}
                        </span>
                      )}
                    </div>

                    {/* Original description */}
                    <Card>
                      <CardContent className="pt-3 pb-3">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail?.description}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {(detail?.messages || []).map((msg: any) => (
                      <div key={msg.id} className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                        msg.isInternal
                          ? "mx-auto bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg max-w-[90%] text-yellow-800 dark:text-yellow-200"
                          : msg.isStaff
                            ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                      )}>
                        {msg.isInternal && (
                          <p className="text-[10px] font-medium uppercase tracking-wide mb-1 opacity-70">Internal note - {msg.senderName}</p>
                        )}
                        {!msg.isInternal && msg.isStaff && (
                          <p className="text-xs opacity-70 mb-0.5">{msg.senderName}</p>
                        )}
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                        <p className={cn("text-xs mt-1", msg.isInternal ? "opacity-50" : "opacity-60")}>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Reply input */}
                  {!["CLOSED"].includes(detail?.status || "") && (
                    <div className="p-4 border-t space-y-2">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center gap-2">
                          <Switch checked={isInternalNote} onCheckedChange={setIsInternalNote} />
                          <Label className={cn("text-xs", isInternalNote && "text-yellow-600 font-medium")}>
                            {isInternalNote ? "Internal note (not visible to customer)" : "Customer reply"}
                          </Label>
                        </div>
                        <Button size="sm" variant="ghost" className="gap-1 text-xs h-6 ml-auto"
                          onClick={() => setShowCannedPicker(!showCannedPicker)}>
                          <Zap className="w-3 h-3" /> Canned
                        </Button>
                      </div>

                      {/* Canned response picker */}
                      {showCannedPicker && (cannedResponses as any[]).length > 0 && (
                        <div className="border rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto bg-muted/50">
                          {(cannedResponses as any[]).map((r: any) => (
                            <button key={r.id}
                              className="w-full text-left p-2 rounded hover:bg-background text-xs transition-colors"
                              onClick={() => useCannedResponse(r)}>
                              <span className="font-medium">{r.title}</span>
                              {r.shortcut && <code className="ml-2 text-[10px] text-muted-foreground">{r.shortcut}</code>}
                            </button>
                          ))}
                        </div>
                      )}

                      <Textarea
                        placeholder={isInternalNote ? "Write an internal note..." : "Type your reply to the customer..."}
                        value={reply} onChange={e => setReply(e.target.value)} rows={3}
                        className={cn(isInternalNote && "border-yellow-300 dark:border-yellow-700")}
                      />
                      <div className="flex justify-end">
                        <Button size="sm" className={cn("gap-2", isInternalNote && "bg-yellow-600 hover:bg-yellow-700")}
                          onClick={() => sendReply.mutate()}
                          disabled={!reply.trim() || sendReply.isPending}>
                          {sendReply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {isInternalNote ? "Add Note" : "Send Reply"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
