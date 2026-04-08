import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, PlusCircle, ChevronRight, Clock, CheckCircle2,
  AlertCircle, Loader2, ShieldCheck, Send, Star, RotateCcw,
  HelpCircle, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Search, ArrowLeft
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const TICKET_STATUS_COLOR: Record<string, string> = {
  OPEN: "default", IN_PROGRESS: "secondary", WAITING: "outline", RESOLVED: "outline", CLOSED: "secondary"
};
const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", WAITING: "Waiting on you", RESOLVED: "Resolved", CLOSED: "Closed"
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "secondary", MEDIUM: "default", HIGH: "destructive", URGENT: "destructive"
};
const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General Enquiry", BILLING: "Billing / Credits", JOB: "Job Issue",
  PROFESSIONAL: "Professional Issue", TECHNICAL: "Technical Problem",
  SAFETY: "Safety Concern", ACCOUNT: "Account Issue"
};

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FaqSection({ onStillNeedHelp }: { onStillNeedHelp: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");

  const { data: articles = [] } = useQuery<any[]>({
    queryKey: ["/api/support/faq"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/support/faq");
      return res.json();
    }
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      await apiRequest("POST", `/api/support/faq/${id}/vote`, { helpful });
    }
  });

  const filtered = (articles as any[]).filter(a => {
    const matchSearch = !searchQuery || a.question.toLowerCase().includes(searchQuery.toLowerCase())
      || a.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCat === "all" || a.category === selectedCat;
    return matchSearch && matchCat;
  });

  const categories = Array.from(new Set((articles as any[]).map((a: any) => a.category)));

  if ((articles as any[]).length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" /> Frequently Asked Questions
        </CardTitle>
        <p className="text-xs text-muted-foreground">Find quick answers before submitting a ticket</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {categories.length > 1 && (
            <Select value={selectedCat} onValueChange={setSelectedCat}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* FAQ items */}
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No matching articles found</p>
          ) : (
            filtered.map((article: any) => (
              <div key={article.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                >
                  <span className="text-sm font-medium pr-2">{article.question}</span>
                  {expandedId === article.id
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>
                {expandedId === article.id && (
                  <div className="px-3 pb-3 border-t bg-muted/20">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-3">{article.answer}</p>
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">Was this helpful?</span>
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-600 transition-colors"
                        onClick={() => voteMutation.mutate({ id: article.id, helpful: true })}
                      >
                        <ThumbsUp className="w-3 h-3" /> Yes
                      </button>
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
                        onClick={() => voteMutation.mutate({ id: article.id, helpful: false })}
                      >
                        <ThumbsDown className="w-3 h-3" /> No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Still need help */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Can't find what you're looking for?</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onStillNeedHelp}>
            <PlusCircle className="w-3.5 h-3.5" /> Submit a support ticket
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── New Ticket Form ──────────────────────────────────────────────────────────
function NewTicketForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("MEDIUM");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/tickets", {
        subject, description, category, priority
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create ticket");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket submitted", description: "We'll get back to you shortly." });
      setSubject(""); setDescription(""); setCategory("GENERAL"); setPriority("MEDIUM");
      onSuccess();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-primary" /> New Support Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject *</Label>
          <Input id="subject" placeholder="Brief summary of your issue" value={subject}
            onChange={e => setSubject(e.target.value)} maxLength={120} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low - general question</SelectItem>
                <SelectItem value="MEDIUM">Medium - needs attention</SelectItem>
                <SelectItem value="HIGH">High - urgent issue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description *</Label>
          <Textarea id="description" placeholder="Please describe your issue in as much detail as possible..."
            value={description} onChange={e => setDescription(e.target.value)} rows={5} maxLength={2000} />
          <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
        </div>
        <Button onClick={() => create.mutate()} disabled={!subject.trim() || !description.trim() || create.isPending}
          className="w-full sm:w-auto gap-2">
          {create.isPending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
            : <><ShieldCheck className="w-3.5 h-3.5" /> Submit Ticket</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Satisfaction Survey Dialog ───────────────────────────────────────────────
function SatisfactionDialog({ ticket, open, onClose }: { ticket: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticket.id}/rate`, { rating, comment });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Thank you for your feedback!" });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your support experience?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(s)} className="p-1 transition-transform hover:scale-110">
                <Star className={`w-8 h-8 ${(hoverRating || rating) >= s
                  ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {rating === 1 ? "Poor" : rating === 2 ? "Fair" : rating === 3 ? "Good"
              : rating === 4 ? "Very Good" : rating === 5 ? "Excellent" : "Select a rating"}
          </p>
          <Textarea placeholder="Any additional feedback? (optional)" value={comment}
            onChange={e => setComment(e.target.value)} rows={3} maxLength={500} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Skip</Button>
          <Button onClick={() => submit.mutate()} disabled={!rating || submit.isPending} className="gap-2">
            {submit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ticket Detail View ───────────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [showRating, setShowRating] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const { data: ticket, isLoading } = useQuery<any>({
    queryKey: ["/api/support/tickets", ticketId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/support/tickets/${ticketId}`);
      return res.json();
    },
    refetchInterval: 10000
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticketId}/messages`, { message: reply });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
      setReply("");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticketId}/reopen`, { reason: reopenReason });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId] });
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setShowReopen(false); setReopenReason("");
      toast({ title: "Ticket reopened" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  if (isLoading) return (
    <Card><CardContent className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>
  );
  if (!ticket) return null;

  const isResolved = ["RESOLVED", "CLOSED"].includes(ticket.status);
  const canReply = !isResolved;
  const canRate = isResolved && !ticket.satisfactionRating;
  const canReopen = isResolved && ticket.reopenCount < 3;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <CardTitle className="text-base">{ticket.subject}</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap ml-6">
                <Badge variant={TICKET_STATUS_COLOR[ticket.status] as any} className="text-xs">
                  {TICKET_STATUS_LABEL[ticket.status]}
                </Badge>
                <Badge variant={PRIORITY_COLOR[ticket.priority] as any} className="text-xs">
                  {ticket.priority}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[ticket.category] || ticket.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Opened {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Original description */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">Your message</p>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Conversation thread */}
          {ticket.messages?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Conversation</p>
              {ticket.messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.isStaff ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.isStaff
                    ? "bg-primary/10 text-foreground rounded-bl-sm border border-primary/20"
                    : "bg-muted text-foreground rounded-br-sm"}`}>
                    {msg.isStaff && (
                      <p className="text-xs font-medium text-primary mb-1">
                        {msg.senderName} (Support)
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status-based actions */}
          {isResolved && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  This ticket was resolved {ticket.resolvedAt && formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}.
                </p>
              </div>

              {/* Satisfaction display or prompt */}
              {ticket.satisfactionRating ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <span className="text-xs text-muted-foreground">Your rating:</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= ticket.satisfactionRating
                        ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {canRate && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowRating(true)}>
                      <Star className="w-3.5 h-3.5" /> Rate this experience
                    </Button>
                  )}
                  {canReopen && (
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setShowReopen(true)}>
                      <RotateCcw className="w-3.5 h-3.5" /> Reopen ticket
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {ticket.status === "WAITING" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                We're waiting for your response. Please reply below.
              </p>
            </div>
          )}

          {/* Reply input */}
          {canReply && (
            <div className="space-y-2 pt-2 border-t">
              <Textarea placeholder="Type your reply..." value={reply}
                onChange={e => setReply(e.target.value)} rows={3} />
              <div className="flex justify-end">
                <Button size="sm" className="gap-2" onClick={() => sendReply.mutate()}
                  disabled={!reply.trim() || sendReply.isPending}>
                  {sendReply.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Reply
                </Button>
              </div>
            </div>
          )}

          {!canReply && !isResolved && (
            <p className="text-xs text-muted-foreground">
              Our support team will respond shortly. Average response time is under 24 hours.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Rating dialog */}
      <SatisfactionDialog ticket={ticket} open={showRating} onClose={() => setShowRating(false)} />

      {/* Reopen dialog */}
      <Dialog open={showReopen} onOpenChange={() => setShowReopen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reopen Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              If your issue isn't fully resolved, you can reopen this ticket. Please explain what's still outstanding.
            </p>
            <Textarea placeholder="What still needs to be addressed?" value={reopenReason}
              onChange={e => setReopenReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReopen(false)}>Cancel</Button>
            <Button onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending} className="gap-2">
              {reopenMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerSupport() {
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"],
    refetchInterval: 30000
  });

  const openTickets = (tickets as any[]).filter(t => ["OPEN", "IN_PROGRESS", "WAITING"].includes(t.status));
  const closedTickets = (tickets as any[]).filter(t => ["RESOLVED", "CLOSED"].includes(t.status));

  // If viewing a ticket detail
  if (selectedTicket) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6 max-w-3xl">
          <TicketDetail ticketId={selectedTicket} onBack={() => setSelectedTicket(null)} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Help & Support</h1>
            <p className="text-sm text-muted-foreground">Check our FAQ or submit a ticket for personalised help</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancel" : "New Ticket"}
          </Button>
        </div>

        {/* New ticket form */}
        {showForm && <NewTicketForm onSuccess={() => setShowForm(false)} />}

        {/* FAQ section */}
        {!showForm && <FaqSection onStillNeedHelp={() => setShowForm(true)} />}

        {/* Empty state */}
        {!isLoading && (tickets as any[]).length === 0 && !showForm && (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm mb-1">No support tickets yet</p>
              <p className="text-xs mb-4">If the FAQ didn't answer your question, open a ticket.</p>
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Open a ticket
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Open tickets */}
        {openTickets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" /> Active Tickets
                <Badge variant="secondary" className="ml-1 text-xs">{openTickets.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openTickets.map((ticket: any) => (
                  <button key={ticket.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-all text-left"
                    onClick={() => setSelectedTicket(ticket.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <Badge variant={TICKET_STATUS_COLOR[ticket.status] as any} className="text-xs">
                        {TICKET_STATUS_LABEL[ticket.status]}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Closed/resolved tickets */}
        {closedTickets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Resolved Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {closedTickets.map((ticket: any) => (
                  <button key={ticket.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-all text-left opacity-70 hover:opacity-100"
                    onClick={() => setSelectedTicket(ticket.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                        </p>
                        {ticket.satisfactionRating && (
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-2.5 h-2.5 ${s <= ticket.satisfactionRating
                                ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <Badge variant="outline" className="text-xs">{TICKET_STATUS_LABEL[ticket.status]}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
