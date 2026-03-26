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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, PlusCircle, ChevronRight, Clock, CheckCircle2,
  AlertCircle, Loader2, ShieldCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TICKET_STATUS_COLOR: Record<string, string> = {
  OPEN: "default", IN_PROGRESS: "secondary", RESOLVED: "outline", CLOSED: "secondary"
};
const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed"
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "secondary", MEDIUM: "default", HIGH: "destructive", URGENT: "destructive"
};

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
      toast({ title: "Ticket submitted", description: "We'll get back to you shortly. Check your ticket status here." });
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
          <Input
            id="subject"
            placeholder="Brief summary of your issue"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">General Enquiry</SelectItem>
                <SelectItem value="BILLING">Billing / Credits</SelectItem>
                <SelectItem value="JOB">Job Issue</SelectItem>
                <SelectItem value="PRO">Professional Issue</SelectItem>
                <SelectItem value="TECHNICAL">Technical Problem</SelectItem>
                <SelectItem value="SAFETY">Safety Concern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low — general question</SelectItem>
                <SelectItem value="MEDIUM">Medium — needs attention</SelectItem>
                <SelectItem value="HIGH">High — urgent issue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder="Please describe your issue in as much detail as possible..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
        </div>

        <Button
          onClick={() => create.mutate()}
          disabled={!subject.trim() || !description.trim() || create.isPending}
          className="w-full sm:w-auto gap-2"
        >
          {create.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
          ) : (
            <><ShieldCheck className="w-3.5 h-3.5" /> Submit Ticket</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CustomerSupport() {
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"]
  });

  const { data: ticketDetail } = useQuery<any>({
    queryKey: ["/api/support/tickets", selectedTicket],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/support/tickets/${selectedTicket}`);
      return res.json();
    },
    enabled: !!selectedTicket
  });

  const openTickets = (tickets as any[]).filter(t => ["OPEN", "IN_PROGRESS"].includes(t.status));
  const closedTickets = (tickets as any[]).filter(t => ["RESOLVED", "CLOSED"].includes(t.status));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Support</h1>
            <p className="text-sm text-muted-foreground">Get help with jobs, bookings, billing or anything else</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => { setShowForm(!showForm); setSelectedTicket(null); }}>
            <PlusCircle className="w-4 h-4" />
            {showForm ? "Cancel" : "New Ticket"}
          </Button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <NewTicketForm onSuccess={() => setShowForm(false)} />
        )}

        {/* Info card if no tickets */}
        {!isLoading && (tickets as any[]).length === 0 && !showForm && (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm mb-1">No support tickets yet</p>
              <p className="text-xs mb-4">Have a question or issue? We're here to help.</p>
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Open a ticket
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Ticket detail panel */}
        {selectedTicket && ticketDetail && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">{ticketDetail.subject}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={TICKET_STATUS_COLOR[ticketDetail.status] as any} className="text-xs">
                      {TICKET_STATUS_LABEL[ticketDetail.status]}
                    </Badge>
                    <Badge variant={PRIORITY_COLOR[ticketDetail.priority] as any} className="text-xs">
                      {ticketDetail.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ticketDetail.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedTicket(null)}>
                  ← Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticketDetail.description}</p>
              </div>

              {ticketDetail.messages?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Replies</p>
                  {ticketDetail.messages.map((msg: any) => (
                    <div key={msg.id} className="p-3 rounded-lg border border-border bg-card text-sm">
                      <p>{msg.message || msg.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {ticketDetail.status === "RESOLVED" ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-700 dark:text-green-400">This ticket has been resolved.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Our support team will respond to your ticket shortly. Average response time is under 24 hours.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Open tickets */}
        {openTickets.length > 0 && !selectedTicket && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" /> Open Tickets
                <Badge variant="secondary" className="ml-1 text-xs">{openTickets.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openTickets.map((ticket: any) => (
                  <button
                    key={ticket.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-all text-left"
                    onClick={() => setSelectedTicket(ticket.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                      </p>
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
        {closedTickets.length > 0 && !selectedTicket && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Resolved Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {closedTickets.map((ticket: any) => (
                  <button
                    key={ticket.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-all text-left opacity-70 hover:opacity-100"
                    onClick={() => setSelectedTicket(ticket.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <Badge variant="outline" className="text-xs">
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
      </div>
    </DashboardLayout>
  );
}
