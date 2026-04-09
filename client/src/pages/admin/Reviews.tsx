import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Star, Eye, EyeOff, MessageSquare, ThumbsUp, BarChart3,
  Search, ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "shrink-0",
            i < rating ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30"
          )}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-4 text-right font-medium text-muted-foreground">{label}</span>
      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="backdrop-blur-md bg-card/60 border-border/40">
      <CardContent className="pt-4 pb-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

interface Review {
  id: number;
  bookingId: number;
  reviewerId: number;
  revieweeId: number;
  rating: number;
  title: string;
  comment: string;
  response: string | null;
  proReply: string | null;
  isVisible: boolean;
  createdAt: string;
  reviewerName: string;
  revieweeName: string;
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  stats: {
    avgRating: number;
    totalReviews: number;
    distribution: Record<string, number>;
  };
}

export default function AdminReviews() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Visibility toggle dialog
  const [toggleTarget, setToggleTarget] = useState<Review | null>(null);
  const [toggleReason, setToggleReason] = useState("");

  const params = new URLSearchParams();
  if (visibilityFilter === "visible") params.set("visible", "true");
  if (visibilityFilter === "hidden") params.set("visible", "false");
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: [`/api/admin/reviews?${params}`],
  });

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = search
    ? reviews.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.reviewerName.toLowerCase().includes(q) ||
          r.revieweeName.toLowerCase().includes(q) ||
          r.title?.toLowerCase().includes(q) ||
          r.comment?.toLowerCase().includes(q)
        );
      })
    : reviews;

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, isVisible, reason }: { id: number; isVisible: boolean; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/reviews/${id}/visibility`, { isVisible, reason });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/reviews") });
      toast({ title: vars.isVisible ? "Review made visible" : "Review hidden" });
      setToggleTarget(null);
      setToggleReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openToggleDialog(review: Review) {
    setToggleTarget(review);
    setToggleReason("");
  }

  function confirmToggle() {
    if (!toggleTarget) return;
    toggleVisibility.mutate({
      id: toggleTarget.id,
      isVisible: !toggleTarget.isVisible,
      reason: toggleReason || undefined,
    });
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Reviews &amp; Moderation</h1>
            <p className="text-sm text-muted-foreground">
              {total} review{total !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="backdrop-blur-md bg-card/60 border-border/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" /> Average Rating
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{parseFloat(String(stats.avgRating)).toFixed(1)}</span>
                  <StarRating rating={Math.round(parseFloat(String(stats.avgRating)))} size={18} />
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-card/60 border-border/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Total Reviews
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span className="text-2xl font-bold">{stats.totalReviews}</span>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-card/60 border-border/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Rating Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1">
                {[5, 4, 3, 2, 1].map((n) => (
                  <RatingBar
                    key={n}
                    label={String(n)}
                    count={stats.distribution[String(n)] ?? 0}
                    total={stats.totalReviews}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by reviewer, reviewee, or content..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select
            value={visibilityFilter}
            onValueChange={(v) => { setVisibilityFilter(v); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="visible">Visible</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Review List */}
        <div className="space-y-2">
          {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No reviews found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
            </div>
          )}

          {!isLoading &&
            filtered.map((r) => (
              <Card
                key={r.id}
                className={cn(
                  "backdrop-blur-md bg-card/60 border-border/40 transition-colors",
                  !r.isVisible && "opacity-60"
                )}
                data-testid={`review-${r.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Rating + Names */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <StarRating rating={r.rating} size={16} />
                        <span className="text-sm font-medium">
                          {r.reviewerName}
                          <span className="text-muted-foreground mx-1.5">&rarr;</span>
                          {r.revieweeName}
                        </span>
                        <Badge variant={r.isVisible ? "default" : "secondary"} className="text-xs">
                          {r.isVisible ? "Visible" : "Hidden"}
                        </Badge>
                      </div>

                      {/* Title */}
                      {r.title && (
                        <p className="font-medium text-sm">{r.title}</p>
                      )}

                      {/* Comment preview */}
                      {r.comment && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{r.comment}</p>
                      )}

                      {/* Pro reply */}
                      {r.proReply && (
                        <div className="mt-2 pl-3 border-l-2 border-primary/30">
                          <p className="text-xs font-medium text-primary flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Pro Reply
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {r.proReply}
                          </p>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Visibility Toggle */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "shrink-0",
                        r.isVisible
                          ? "text-muted-foreground hover:text-destructive"
                          : "text-muted-foreground hover:text-green-600"
                      )}
                      onClick={() => openToggleDialog(r)}
                      data-testid={`toggle-visibility-${r.id}`}
                    >
                      {r.isVisible ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Visibility Toggle Confirmation Dialog */}
      <Dialog open={!!toggleTarget} onOpenChange={() => { setToggleTarget(null); setToggleReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.isVisible ? "Hide Review" : "Show Review"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {toggleTarget?.isVisible
                ? "This review will no longer be visible to users. You can restore it later."
                : "This review will become visible to all users again."}
            </p>
            {toggleTarget && (
              <div className="rounded-md border p-3 space-y-1 bg-muted/30">
                <div className="flex items-center gap-2">
                  <StarRating rating={toggleTarget.rating} size={14} />
                  <span className="text-xs text-muted-foreground">
                    by {toggleTarget.reviewerName}
                  </span>
                </div>
                {toggleTarget.title && (
                  <p className="text-sm font-medium">{toggleTarget.title}</p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">{toggleTarget.comment}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder={
                  toggleTarget?.isVisible
                    ? "e.g. Inappropriate language, spam, etc."
                    : "e.g. Reviewed and cleared"
                }
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                rows={2}
                data-testid="input-toggle-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setToggleTarget(null); setToggleReason(""); }}>
              Cancel
            </Button>
            <Button
              variant={toggleTarget?.isVisible ? "destructive" : "default"}
              onClick={confirmToggle}
              disabled={toggleVisibility.isPending}
              data-testid="button-confirm-toggle"
            >
              {toggleVisibility.isPending
                ? "Updating..."
                : toggleTarget?.isVisible
                  ? "Hide Review"
                  : "Show Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
