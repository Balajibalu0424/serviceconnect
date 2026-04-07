import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReviewReplyFormProps {
  reviewId: string;
  onReplied: () => void;
}

export function ReviewReplyForm({ reviewId, onReplied }: ReviewReplyFormProps) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submitReply = async () => {
    if (!reply.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/reviews/${reviewId}/reply`, { reply });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Response posted", description: "Your reply has been added to this review." });
      onReplied();
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
      >
        Respond to this review
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        value={reply}
        onChange={e => setReply(e.target.value)}
        placeholder="Write a professional, constructive response..."
        rows={3}
        maxLength={1000}
        className="text-sm resize-none"
      />
      <p className="text-xs text-gray-400">
        {reply.length}/1000 · Your response is permanent and cannot be edited after posting.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={submitReply} disabled={loading || !reply.trim()}>
          {loading ? "Posting..." : "Post Response"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setReply(""); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
