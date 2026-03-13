import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dices, Trophy, Clock, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { label: "Credits", color: "#3B82F6", emoji: "💰" },
  { label: "Boost", color: "#10B981", emoji: "🚀" },
  { label: "Badge", color: "#F59E0B", emoji: "🏅" },
  { label: "Discount", color: "#8B5CF6", emoji: "🎟️" },
  { label: "No Prize", color: "#6B7280", emoji: "😅" },
];

export default function ProSpinWheel() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const wheelRef = useRef<SVGElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [result, setResult] = useState<any>(null);

  const { data: status } = useQuery<any>({ queryKey: ["/api/spin-wheel/status"] });

  const spin = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/spin-wheel/spin");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      const segmentAngle = 360 / SEGMENTS.length;
      const targetIndex = data.segmentIndex;
      const targetAngle = 360 - (targetIndex * segmentAngle + segmentAngle / 2);
      const totalSpins = 5;
      const finalAngle = currentAngle + totalSpins * 360 + targetAngle;

      setIsSpinning(true);
      if (wheelRef.current) {
        const el = wheelRef.current as any;
        el.style.transition = "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
        el.style.transform = `rotate(${finalAngle}deg)`;
      }

      setTimeout(() => {
        setCurrentAngle(finalAngle % 360);
        setIsSpinning(false);
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/spin-wheel/status"] });
        refreshUser();
        toast({ title: data.message, description: `Streak: ${data.spinStreak} spins!` });
      }, 3600);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const segmentAngle = 360 / SEGMENTS.length;
  const r = 140;
  const cx = 160, cy = 160;

  function describeArc(startAngle: number, endAngle: number) {
    const toRad = (d: number) => (d - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Spin the Wheel</h1>
            <p className="text-sm text-muted-foreground">Win prizes every 72 hours</p>
          </div>
          {status?.spinStreak > 0 && (
            <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-2 rounded-full">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="font-bold text-orange-500 text-sm">{status.spinStreak} streak</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* Wheel */}
          <div className="relative">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[24px] border-l-transparent border-r-transparent border-b-destructive" />
            </div>
            <svg ref={wheelRef as any} width="320" height="320" className="drop-shadow-xl" style={{ transformOrigin: "center" }}>
              {SEGMENTS.map((seg, i) => {
                const startAngle = i * segmentAngle;
                const endAngle = (i + 1) * segmentAngle;
                const midAngle = (startAngle + endAngle) / 2;
                const labelR = r * 0.65;
                const toRad = (d: number) => (d - 90) * Math.PI / 180;
                const lx = cx + labelR * Math.cos(toRad(midAngle));
                const ly = cy + labelR * Math.sin(toRad(midAngle));
                return (
                  <g key={seg.label}>
                    <path d={describeArc(startAngle, endAngle)} fill={seg.color} stroke="white" strokeWidth="2" />
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20">{seg.emoji}</text>
                    <text x={lx} y={ly + 18} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="bold">{seg.label}</text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={20} fill="white" stroke="#e5e7eb" strokeWidth="2" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="16">🎯</text>
            </svg>
          </div>

          {/* Status / Result */}
          {result && !isSpinning && (
            <Card className="w-full max-w-sm border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-4xl mb-2">{SEGMENTS.find(s => s.label.toLowerCase().includes(result.prizeType.toLowerCase().slice(0,4)))?.emoji || "🎯"}</div>
                <p className="font-bold">{result.message}</p>
                {result.prizeValue > 0 && <p className="text-sm text-muted-foreground">{result.prizeType === "CREDITS" ? `+${result.prizeValue} credits added` : result.prizeType === "DISCOUNT" ? `${result.prizeValue}% discount earned` : ""}</p>}
              </CardContent>
            </Card>
          )}

          {/* CTA */}
          {status?.eligible ? (
            <Button size="lg" className="gap-2 text-base px-8" onClick={() => spin.mutate()} disabled={isSpinning || spin.isPending} data-testid="button-spin">
              <Dices className="w-5 h-5" />
              {isSpinning ? "Spinning..." : "Spin the Wheel!"}
            </Button>
          ) : (
            <div className="text-center">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Next spin available in {status?.nextEligibleAt ? formatDistanceToNow(new Date(status.nextEligibleAt)) : "72 hours"}</span>
              </div>
              <Button size="lg" disabled className="gap-2">
                <Dices className="w-5 h-5" /> Spin the Wheel
              </Button>
            </div>
          )}
        </div>

        {/* Prize guide */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <h3 className="font-semibold mb-3 text-sm">Prize Guide</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: "Credits (25%)", desc: "1–5 free credits", color: "bg-blue-500" },
                { label: "Boost (15%)", desc: "Profile boosted 24h", color: "bg-emerald-500" },
                { label: "Badge (10%)", desc: "Earn a badge", color: "bg-amber-500" },
                { label: "Discount (15%)", desc: "20% off next lead", color: "bg-violet-500" },
                { label: "No Prize (35%)", desc: "Try again in 72h", color: "bg-gray-500" },
              ].map(p => (
                <div key={p.label} className="text-center p-2 rounded-lg bg-muted">
                  <div className={`w-3 h-3 rounded-full ${p.color} mx-auto mb-1`} />
                  <p className="text-xs font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
