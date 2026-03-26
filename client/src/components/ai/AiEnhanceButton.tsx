import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check } from "lucide-react";
import { getAccessToken } from "@/lib/queryClient";

interface AiEnhanceButtonProps {
  endpoint: string;
  payload: Record<string, any>;
  onResult: (result: any) => void;
  label?: string;
  className?: string;
}

export default function AiEnhanceButton({
  endpoint,
  payload,
  onResult,
  label = "Enhance with AI",
  className = "",
}: AiEnhanceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const enhance = async () => {
    setLoading(true);
    setDone(false);
    try {
      const token = getAccessToken();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      onResult(data);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error("AI enhance failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={enhance}
      disabled={loading}
      className={`gap-1.5 text-xs font-medium border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950 transition-all duration-300 ${
        done ? "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950" : ""
      } ${className}`}
      data-testid="ai-enhance-button"
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Enhancing...
        </>
      ) : done ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Enhanced!
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </Button>
  );
}
