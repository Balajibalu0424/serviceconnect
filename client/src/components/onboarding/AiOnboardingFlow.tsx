import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, User, Bot, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export interface AiOnboardingData {
  title?: string;
  description?: string;
  categoryId?: string | number;
  locationText?: string;
  urgency?: string;
  budgetMin?: string | null;
  budgetMax?: string | null;
  categoryIds?: string[];
  bio?: string;
  location?: string;
  yearsExperience?: number;
  serviceRadius?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface AiOnboardingFlowProps {
  mode: "CUSTOMER" | "PROFESSIONAL";
  onComplete: (data: AiOnboardingData) => void;
  initialMessage?: string;
  isLoggedIn?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiOnboardingFlow({ mode, onComplete, initialMessage, isLoggedIn = true }: AiOnboardingFlowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && !isLoading && !isCompleted) {
      const greeting = initialMessage || (mode === "CUSTOMER" 
        ? "Hi there! Tell me what you need done, what part of the property or project is affected, and where it is. I'll ask one specific follow-up at a time if anything important is missing."
        : "Hi! Tell me what services you offer, where you cover, and what makes you good at it. I'll ask only for the next missing detail.");
      
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [mode, initialMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/ai/onboarding-chat", {
        messages: newMessages,
        mode,
        isLoggedIn
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to get AI response");

      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);

      if (data.isComplete && data.extractedData) {
        setIsCompleted(true);
        // Small delay to let the user read the final message before progressing
        setTimeout(() => {
          onComplete(data.extractedData);
        }, 2000);
      }
    } catch (error) {
      console.error("AI Onboarding Error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm having a little trouble connecting right now. Could you please answer that last question again?" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] border border-border bg-card rounded-xl overflow-hidden shadow-sm relative">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">ServiceConnect AI</h3>
          <p className="text-xs text-muted-foreground">
            {mode === "CUSTOMER" ? "Helping you post your job instantly" : "Setting up your pro profile"}
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-2xl mx-auto pb-4">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                  msg.role === "user" ? "bg-primary text-white" : "bg-muted text-foreground"
                )}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className={cn(
                  "p-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user" 
                    ? "bg-primary text-white rounded-tr-sm" 
                    : "bg-muted/50 border border-border text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start w-full">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-muted text-foreground">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-2xl bg-muted/50 border border-border text-foreground rounded-tl-sm flex items-center gap-1.5 h-10 w-16">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {isCompleted && (
            <div className="flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in duration-500">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-medium text-center">Perfect, I have everything I need!</p>
              <p className="text-sm text-muted-foreground text-center">Preparing your details...</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 bg-background border-t border-border mt-auto">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto relative">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isCompleted ? "Chat finished" : "Type your answer..."}
            className="flex-1 rounded-full pl-4 pr-12 focus-visible:ring-primary/50"
            disabled={isLoading || isCompleted}
            autoFocus
          />
          <Button 
            type="submit" 
            size="icon"
            className="rounded-full shrink-0 absolute right-1 top-1 h-8 w-8"
            disabled={!input.trim() || isLoading || isCompleted}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
