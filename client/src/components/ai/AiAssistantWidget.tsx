import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Sparkles, Bot, User, Briefcase, LifeBuoy, ArrowLeft, Send, CheckCircle2, Loader2, FileEdit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken, apiRequest } from "@/lib/queryClient";
import { AI_DISPLAY_NAME } from "@/lib/constants";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type WidgetMode = "home" | "post_job" | "support_ticket";
type CollectionStage = "chat" | "confirming" | "creating" | "done";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DraftData {
  title: string;
  description: string;
  categorySlug?: string;
  locationText?: string;
  locationTown?: string;
  locationEircode?: string;
  urgency?: string;
  budgetMin?: number;
  budgetMax?: number;
}

const TICKET_CATEGORIES = [
  { value: "GENERAL", label: "General question" },
  { value: "BILLING", label: "Billing / payments" },
  { value: "JOB", label: "Job issue" },
  { value: "PROFESSIONAL", label: "Professional issue" },
  { value: "TECHNICAL", label: "Technical problem" },
  { value: "SAFETY", label: "Safety concern" },
];

// Simple extraction of job data from conversation
function extractJobDraft(messages: Message[]): DraftData | null {
  const userMsgs = messages.filter(m => m.role === "user").map(m => m.content);
  if (userMsgs.length === 0) return null;
  const combined = userMsgs.join(" ");
  if (combined.length < 10) return null;

  // Use the first substantial user message as a basis
  const firstMsg = userMsgs[0];
  const title = firstMsg.split(/[.!?\n]/)[0].trim().slice(0, 80) || "Service Request";

  // Combine all user messages into description
  const description = userMsgs.join("\n").trim();

  // Try to extract location mentions (Irish cities/towns)
  const locationPatterns = /\b(dublin|cork|galway|limerick|waterford|kilkenny|wexford|sligo|drogheda|dundalk|bray|navan|ennis|tralee|carlow|athlone|letterkenny|tullamore|castlebar|clonmel|longford|mullingar|portlaoise|mallow|enniscorthy|wicklow|newbridge|naas|celbridge|leixlip|maynooth|swords|malahide|howth|dalkey|dun laoghaire)\b/i;
  const locationMatch = combined.match(locationPatterns);
  const locationTown = locationMatch ? locationMatch[1].charAt(0).toUpperCase() + locationMatch[1].slice(1).toLowerCase() : undefined;

  // Try to detect eircode (Irish format: A65 F4E2, D01 R2C0)
  const eircodeMatch = combined.match(/\b([A-Z]\d{2}\s?[A-Z0-9]{4})\b/i);
  const locationEircode = eircodeMatch ? eircodeMatch[1].toUpperCase().replace(/\s+/g, " ") : undefined;

  // Detect urgency keywords
  const urgentPatterns = /\b(urgent|emergency|asap|today|immediately|right now|broken|flooding|leak|burst)\b/i;
  const urgency = urgentPatterns.test(combined) ? "URGENT" : "NORMAL";

  return {
    title,
    description,
    locationText: locationTown || undefined,
    locationTown,
    locationEircode,
    urgency,
  };
}

export default function AiAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<WidgetMode>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketCategory, setTicketCategory] = useState("GENERAL");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketDone, setTicketDone] = useState(false);
  const [collectionStage, setCollectionStage] = useState<CollectionStage>("chat");
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!user) return null;

  const resetWidget = () => {
    setMode("home");
    setMessages([]);
    setInput("");
    setTicketDesc("");
    setTicketDone(false);
    setCollectionStage("chat");
    setDraftData(null);
    setCreatedJobId(null);
  };

  const startPostJob = () => {
    setMode("post_job");
    setCollectionStage("chat");
    setMessages([{
      role: "assistant",
      content: `Hi ${user.firstName}! Tell me what you need help with — describe the job and I'll get it set up for you. Include as much detail as you can: what's the issue, where are you located, and how urgent is it?`,
    }]);
  };

  const startSupport = () => {
    setMode("support_ticket");
    setTicketDone(false);
    setTicketDesc("");
    setTicketCategory("GENERAL");
  };

  const sendJobMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: userMsg, history: newMessages.slice(-8), mode: "post_job" }),
      });
      const data = await res.json();
      const aiReply = data.reply || "I can help you post a job. What service do you need?";
      setMessages([...newMessages, { role: "assistant", content: aiReply }]);

      // After 1+ user messages with sufficient detail, show "Ready to create" option
      const userCount = newMessages.filter(m => m.role === "user").length;
      const combinedLen = newMessages.filter(m => m.role === "user").map(m => m.content).join(" ").length;
      if (userCount >= 1 && combinedLen >= 30) {
        const draft = extractJobDraft(newMessages);
        if (draft && draft.description.length > 20) {
          setDraftData(draft);
        }
      }
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "Having trouble connecting. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const createJobDraft = async () => {
    if (!draftData) return;
    setCollectionStage("creating");
    try {
      // First enhance the description via AI
      let enhancedDesc = draftData.description;
      try {
        const enhanceRes = await apiRequest("POST", "/api/ai/enhance-description", {
          title: draftData.title,
          description: draftData.description,
          category: "general",
        });
        if (enhanceRes.ok) {
          const enhanceData = await enhanceRes.json();
          enhancedDesc = enhanceData.enhanced || enhanceData.description || enhancedDesc;
        }
      } catch { /* use original if enhance fails */ }

      const res = await apiRequest("POST", "/api/ai/create-draft", {
        ...draftData,
        description: enhancedDesc,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const job = await res.json();
      setCreatedJobId(job.id);
      setCollectionStage("done");
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (e: any) {
      toast({ title: "Could not create draft", description: e.message, variant: "destructive" });
      setCollectionStage("chat");
    }
  };

  const goToJobReview = () => {
    setIsOpen(false);
    resetWidget();
    if (createdJobId) {
      navigate(`/jobs/${createdJobId}`);
    } else {
      navigate("/post-job");
    }
  };

  const submitTicket = async () => {
    if (!ticketDesc.trim()) return;
    setTicketLoading(true);
    try {
      const res = await apiRequest("POST", "/api/support/tickets", {
        subject: ticketDesc.trim().slice(0, 100),
        description: ticketDesc.trim(),
        category: ticketCategory,
        priority: "MEDIUM",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setTicketDone(true);
    } catch (e: any) {
      toast({ title: "Could not submit ticket", description: e.message, variant: "destructive" });
    } finally {
      setTicketLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-2xl hover:shadow-blue-500/25 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
          aria-label="Open assistant"
          data-testid="ai-assistant-trigger"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
        </button>
      )}

      {/* Widget panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 animate-in slide-in-from-bottom-4 duration-300"
          style={{ maxHeight: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              {mode !== "home" && (
                <button
                  onClick={resetWidget}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors mr-1"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{AI_DISPLAY_NAME}</p>
                <p className="text-xs text-blue-100">
                  {mode === "home" ? "How can I help?" : mode === "post_job" ? "Posting a job" : "Get support"}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setIsOpen(false); resetWidget(); }}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Home mode — two action buttons */}
          {mode === "home" && (
            <div className="flex-1 flex flex-col gap-4 p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Hi {user.firstName}! What would you like to do?
              </p>

              <button
                onClick={startPostJob}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Post a Job</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Describe what you need and find professionals</p>
                </div>
              </button>

              <button
                onClick={startSupport}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-violet-100 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center group-hover:bg-violet-200 dark:group-hover:bg-violet-800 transition-colors flex-shrink-0">
                  <LifeBuoy className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Get Support</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Report an issue or ask for help</p>
                </div>
              </button>
            </div>
          )}

          {/* Post Job chat mode */}
          {mode === "post_job" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {collectionStage === "done" ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Job draft created!</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your job has been saved as a draft with AI-enhanced description. Review and publish it to go live.
                  </p>
                  <Button size="sm" className="w-full mt-2 gap-2" onClick={goToJobReview}>
                    <FileEdit className="w-4 h-4" /> Review & Publish
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetWidget}>
                    Post another job
                  </Button>
                </div>
              ) : collectionStage === "creating" ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Creating your job draft...</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">AI is enhancing your description for best results</p>
                </div>
              ) : (
                <>
                  <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3"
                    style={{ maxHeight: "280px" }}
                  >
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === "user"
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white"
                        }`}>
                          {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 px-3.5 py-2.5 rounded-2xl rounded-tl-sm">
                          <div className="flex gap-1 items-center h-4">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Draft ready banner */}
                  {draftData && collectionStage === "chat" && (
                    <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-t border-emerald-200/50 dark:border-emerald-900/50 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Ready to create job draft</p>
                      </div>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mb-2 line-clamp-2">
                        "{draftData.title}"
                        {draftData.locationTown && ` \u00b7 ${draftData.locationTown}`}
                        {draftData.urgency === "URGENT" && " \u00b7 Urgent"}
                      </p>
                      <Button size="sm" className="w-full text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={createJobDraft}>
                        <Sparkles className="w-3.5 h-3.5" /> Create AI-Enhanced Draft
                      </Button>
                    </div>
                  )}

                  <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 flex-shrink-0">
                    <Input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendJobMessage()}
                      placeholder="Describe what you need..."
                      className="flex-1 h-9 text-sm"
                      disabled={loading}
                    />
                    <Button size="sm" onClick={sendJobMessage} disabled={loading || !input.trim()} className="h-9 w-9 p-0">
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="px-3 pb-3 flex-shrink-0">
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setIsOpen(false); navigate("/post-job"); resetWidget(); }}>
                      Open full job posting form →
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Support Ticket mode */}
          {mode === "support_ticket" && (
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {ticketDone ? (
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <LifeBuoy className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Ticket submitted!</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    You can track progress in the Support section of your dashboard.
                  </p>
                  <Button variant="outline" size="sm" onClick={resetWidget}>Back</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <select
                      value={ticketCategory}
                      onChange={e => setTicketCategory(e.target.value)}
                      className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TICKET_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Describe your issue</label>
                    <textarea
                      value={ticketDesc}
                      onChange={e => setTicketDesc(e.target.value)}
                      placeholder="Please describe the issue in as much detail as possible..."
                      rows={5}
                      className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 resize-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <Button
                    onClick={submitTicket}
                    disabled={ticketLoading || !ticketDesc.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {ticketLoading ? "Submitting..." : "Submit Support Ticket"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
