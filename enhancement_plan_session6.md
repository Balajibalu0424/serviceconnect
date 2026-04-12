# ServiceConnect — Session 6 Final Enhancement Pass Plan

**Date:** 2026-04-11  
**Scope:** Retest → gap audit → final backend + frontend enhancement pass  
**Total files to modify:** 9

---

## Gap Audit Summary (vs implementation_report1.md)

### Confirmed bugs:
1. `q.estimatedDays` in `customer/JobDetail.tsx` is always undefined — field is actually `q.estimatedDuration`
2. `q.professional` in customer quote cards is always undefined — GET /api/quotes doesn't return professional data for customer role
3. `URGENT_JOB` deep-link in Notifications has no `jobId` param → cannot route to specific job
4. `NEW_JOB_AVAILABLE` type has no icon, no filter group, no deep-link handler
5. `BOOKING_IN_PROGRESS` type has no icon, no filter group, no deep-link handler

### Confirmed missing backend logic:
6. No `NEW_JOB_AVAILABLE` notification fan-out when job is published (POST /api/jobs/:id/publish)
7. No `BOOKING_IN_PROGRESS` notification when booking moves to in-progress
8. `QUOTE_ACCEPTED` / `BOOKING_CREATED` notifications don't include `conversationId` in data → pro can't navigate directly to chat
9. GET /api/bookings doesn't return `hasReview` flag → cannot show conditional "Leave a Review" CTA

### Confirmed missing frontend features:
10. Pro Bookings has no cancel button
11. Customer Bookings has no "Leave a Review" button on completed bookings
12. Customer JobDetail has no prominent review CTA in completed state
13. Pro JobFeed has no "Quote sent" badge (job has no `myQuote` in feed response)
14. Pro JobFeed doesn't handle `?highlight=jobId` deep-link from notifications
15. Pro Dashboard matchbooked preview doesn't distinguish "quoted" vs "not yet quoted"

---

## Implementation Plan (Priority Order)

### BATCH 1 — Backend (server/routes.ts) — all independent, implement together

#### A1: NEW_JOB_AVAILABLE fan-out on job publish
**Location:** POST /api/jobs/:id/publish route (after db.update to LIVE)
**Logic:**
```typescript
// Fan-out notifications to matching pros
try {
  const published = updatedJob; // the updated job object
  const matchingPros = await db.select({ id: users.id })
    .from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(and(
      eq(users.role, "PROFESSIONAL"),
      eq(users.status, "ACTIVE"),
      sql`${professionalProfiles.serviceCategories}::jsonb ? ${published.categoryId}`
    ));
  const notifType = published.aiIsUrgent ? "URGENT_JOB" : "NEW_JOB_AVAILABLE";
  const notifTitle = published.aiIsUrgent ? "🚨 Urgent job near you" : "New job in your area";
  const notifMsg = `${published.title} — be first to quote.`;
  await Promise.allSettled(
    matchingPros.slice(0, 50).map(pro =>
      createNotification(pro.id, notifType, notifTitle, notifMsg, { jobId: published.id, categoryId: published.categoryId })
    )
  );
} catch (e) { /* notification failure should not block publish */ }
```

#### A2: BOOKING_IN_PROGRESS notification
**Location:** POST /api/bookings/:id/in-progress route (after db.update to IN_PROGRESS)
**Logic:**
```typescript
await createNotification(
  booking.customerId,
  "BOOKING_IN_PROGRESS",
  "Work has started",
  "Your professional has started work on your booking.",
  { bookingId: booking.id, jobId: booking.jobId }
);
```

#### A3: conversationId in QUOTE_ACCEPTED / BOOKING_CREATED notifications
**Location:** POST /api/quotes/:id/accept route, after the transaction block
**Logic:** Before the createNotification calls, look up the conversation:
```typescript
const [jobConv] = await db.select({ id: conversations.id })
  .from(conversations)
  .where(eq(conversations.jobId, quote.jobId))
  .orderBy(desc(conversations.createdAt))
  .limit(1);
const convId = jobConv?.id ?? null;
// Then pass conversationId: convId in both notification data objects
```

#### A4: professional enrichment in GET /api/quotes (for customer role)
**Location:** GET /api/quotes enrichment mapper (inside Promise.all map)
**Logic:** Add a professional lookup per quote:
```typescript
const [proUser] = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
  .from(users).where(eq(users.id, q.professionalId));
const [proProfile] = await db.select({ ratingAvg: professionalProfiles.ratingAvg, totalReviews: professionalProfiles.totalReviews })
  .from(professionalProfiles).where(eq(professionalProfiles.userId, q.professionalId));
// Return: { ...q, job, category, conversationId, professional: proUser ? { ...proUser, ratingAvg: proProfile?.ratingAvg, totalReviews: proProfile?.totalReviews ?? 0 } : null }
```

#### A5: hasReview flag in GET /api/bookings
**Location:** GET /api/bookings enrichment mapper
**Logic:**
```typescript
const [existingReview] = await db.select({ id: reviews.id }).from(reviews)
  .where(and(eq(reviews.bookingId, b.id), eq(reviews.reviewerId, b.customerId)));
// Return: { ...b, hasReview: !!existingReview, job, customer, professional, conversationId }
```

#### A6: myQuote in GET /api/jobs/feed
**Location:** GET /api/jobs/feed enrichment mapper (inside result Promise.all map)
**Logic:**
```typescript
const [myQuote] = await db.select({ id: quotes.id, status: quotes.status })
  .from(quotes)
  .where(and(eq(quotes.jobId, row.job.id), eq(quotes.professionalId, proId)));
// Return: { ...row.job, ..., myQuote: myQuote ? { id: myQuote.id, status: myQuote.status } : null }
```

---

### BATCH 2 — Customer Notifications (customer/Notifications.tsx)

#### B1: Add NEW_JOB_AVAILABLE and BOOKING_IN_PROGRESS icons
In NOTIFICATION_ICONS map, add:
```typescript
NEW_JOB_AVAILABLE: { icon: Briefcase, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
BOOKING_IN_PROGRESS: { icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
```
(Both icons already imported)

#### B2: Fix URGENT_JOB deep-link to include jobId
Change `case "URGENT_JOB":` in getNotificationLink:
```typescript
case "URGENT_JOB":
  return isProRole
    ? (data.jobId ? `/pro/feed?highlight=${data.jobId}` : "/pro/feed")
    : null;
```

#### B3: Add NEW_JOB_AVAILABLE deep-link
Add new case in getNotificationLink:
```typescript
case "NEW_JOB_AVAILABLE":
  return isProRole
    ? (data.jobId ? `/pro/feed?highlight=${data.jobId}` : "/pro/feed")
    : null;
```

#### B4: Add BOOKING_IN_PROGRESS deep-link
Add new case in getNotificationLink:
```typescript
case "BOOKING_IN_PROGRESS":
  return isProRole
    ? (data.bookingId ? "/pro/bookings" : "/pro/bookings")
    : "/bookings";
```

#### B5: Improve QUOTE_ACCEPTED deep-link for pro (use conversationId if available)
Change `case "QUOTE_ACCEPTED":`:
```typescript
case "QUOTE_ACCEPTED":
  return isProRole
    ? (data.conversationId ? `/pro/chat?conversationId=${data.conversationId}` : "/pro/leads")
    : (data.jobId ? `/jobs/${data.jobId}` : null);
```

#### B6: Add NEW_JOB_AVAILABLE to filter groups
In filter button logic, add "NEW_JOB_AVAILABLE" and "URGENT_JOB" to the JOB_UPDATE group:
```typescript
// In filterTypes for "JOB_UPDATE"
["JOB_UPDATE", "JOB_STATUS", "JOB_CLOSED", "JOB_BOOSTED", "JOB_MATCHED", "JOB_AUTO_CLOSED", "NEW_JOB_AVAILABLE", "URGENT_JOB"]
```
Add "BOOKING_IN_PROGRESS" to the BOOKING group.

---

### BATCH 3 — Customer JobDetail (customer/JobDetail.tsx)

#### F1: Fix estimatedDays → estimatedDuration
Find: `{q.estimatedDays && (`
Replace with: `{q.estimatedDuration && (`
Find: `Est. {q.estimatedDays} day{q.estimatedDays !== 1 ? "s" : ""}`
Replace with: `Est. {q.estimatedDuration}`

#### F2: Show professional rating in quote card
After the `q.professional` initials avatar block, add:
```tsx
{q.professional?.ratingAvg && Number(q.professional.ratingAvg) > 0 && (
  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
    <span className="font-medium">{Number(q.professional.ratingAvg).toFixed(1)}</span>
    {q.professional.totalReviews > 0 && (
      <span className="text-muted-foreground">({q.professional.totalReviews})</span>
    )}
  </span>
)}
```

#### F3: Prominent review CTA card in completed state
Replace the simple `Button` "Review this professional" in the COMPLETED state (line ~555) with a full card:
```tsx
{isCompleted && !showReview && (
  <Card className="border-emerald-400/50 bg-emerald-50/50 dark:bg-emerald-950/20">
    <CardContent className="pt-4 pb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Job complete — how did it go?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Your feedback helps others find great professionals.</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 shadow-sm shrink-0"
          onClick={() => setShowReview(true)} data-testid="button-leave-review">
          <Star className="w-3.5 h-3.5" /> Leave a Review
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

### BATCH 4 — Customer Bookings (customer/Bookings.tsx)

#### H1: Leave a Review button for completed bookings
Add `Star` to lucide-react imports.
In the booking card's action area, for COMPLETED status add:
```tsx
{b.status === "COMPLETED" && !b.hasReview && (
  <Button size="sm" variant="default"
    className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-9 px-3 text-xs"
    onClick={() => navigate(`/jobs/${b.jobId}`)}>
    <Star className="w-3.5 h-3.5" /> Leave a Review
  </Button>
)}
```

---

### BATCH 5 — Pro Bookings (pro/Bookings.tsx)

#### D1: Add cancel booking capability
Add imports: `XCircle` (from lucide-react), `Textarea` and `Label` (from ui).
Add state: `const [showCancelConfirm, setShowCancelConfirm] = useState(false); const [cancelReason, setCancelReason] = useState("");`
Add mutation:
```typescript
const cancelBooking = useMutation({
  mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
    const res = await apiRequest("POST", `/api/bookings/${id}/cancel`, { reason });
    if (!res.ok) throw new Error((await res.json()).error || "Failed");
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    toast({ title: "Booking cancelled", description: "The customer has been notified." });
    setSelectedBooking(null); setCancelReason(""); setShowCancelConfirm(false);
  },
  onError: (error: Error) => {
    toast({ title: "Cancel failed", description: error.message, variant: "destructive" });
  }
});
```

In the dialog action area, after the status-specific buttons, for CONFIRMED/IN_PROGRESS:
```tsx
{(selectedBooking.status === "CONFIRMED" || selectedBooking.status === "IN_PROGRESS") && !showCancelConfirm && (
  <Button variant="outline" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
    onClick={() => setShowCancelConfirm(true)}>
    <XCircle className="w-4 h-4" /> Cancel Booking
  </Button>
)}
{showCancelConfirm && (
  <div className="flex flex-col gap-2 w-full border border-destructive/30 rounded-xl p-3 bg-destructive/5">
    <p className="text-sm font-medium text-destructive">Cancel this booking?</p>
    <Textarea placeholder="Reason (optional)..." value={cancelReason}
      onChange={e => setCancelReason(e.target.value)} rows={2} className="text-sm" />
    <div className="flex gap-2 justify-end">
      <Button size="sm" variant="ghost" onClick={() => setShowCancelConfirm(false)}>Back</Button>
      <Button size="sm" variant="destructive"
        onClick={() => cancelBooking.mutate({ id: selectedBooking.id, reason: cancelReason })}
        disabled={cancelBooking.isPending}>
        {cancelBooking.isPending ? "Cancelling…" : "Confirm Cancel"}
      </Button>
    </div>
  </div>
)}
```

---

### BATCH 6 — Pro Job Feed (pro/JobFeed.tsx)

#### E2: "Quote sent" badge on job cards
In the badges area of each job card, after urgency/boosted badges:
```tsx
{job.myQuote && (
  <Badge className="text-xs bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 gap-1">
    <CheckCircle2 className="w-3 h-3" /> Quote sent
  </Badge>
)}
```

#### E3: highlight query param for notification deep-links
At component top, after existing imports/state:
```typescript
const [location] = useLocation();
const highlightJobId = useMemo(() => {
  const search = location.includes("?") ? location.split("?")[1] : "";
  return new URLSearchParams(search).get("highlight") || null;
}, [location]);
```

Add `data-testid={`feed-job-${job.id}`}` to each job card div.

Add ring highlight to card className:
```typescript
cn("...", highlightJobId === job.id && "ring-2 ring-primary/60 shadow-primary/10")
```

Add scroll effect:
```typescript
useEffect(() => {
  if (highlightJobId && displayJobs.length > 0) {
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="feed-job-${highlightJobId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }
}, [highlightJobId, displayJobs.length]);
```
Import `useMemo` from react.

---

### BATCH 7 — Customer Dashboard (customer/Dashboard.tsx)

#### G1: Pro names under pending quote badge in pipeline
After building `pendingQuotesByJob` map (already exists), add:
```typescript
const pendingQuoteProsByJob: Record<string, string[]> = {};
(pendingQuotes as any[]).forEach((q: any) => {
  if (q.jobId && q.professional?.firstName) {
    if (!pendingQuoteProsByJob[q.jobId]) pendingQuoteProsByJob[q.jobId] = [];
    pendingQuoteProsByJob[q.jobId].push(q.professional.firstName);
  }
});
```

In the job card render, after the quote count badge block:
```tsx
{pendingQuotesByJob[job.id] > 0 && pendingQuoteProsByJob[job.id]?.length > 0 && (
  <p className="text-[10px] text-muted-foreground mt-0.5 text-right leading-tight">
    from {pendingQuoteProsByJob[job.id].slice(0, 2).join(", ")}
    {pendingQuoteProsByJob[job.id].length > 2 && ` +${pendingQuoteProsByJob[job.id].length - 2} more`}
  </p>
)}
```

---

### BATCH 8 — Pro Leads (pro/Leads.tsx)

#### C1: View Feed link for PENDING quotes
In renderQuoteCard, in the action column for PENDING quotes (after/alongside chat button):
```tsx
{q.status === "PENDING" && q.job?.status && ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(q.job.status) && (
  <a href="/#/pro/feed">
    <Button variant="ghost" size="sm" className="text-xs h-7 px-2.5 rounded-xl gap-1 text-muted-foreground">
      <Briefcase className="w-3 h-3" /> View Feed
    </Button>
  </a>
)}
```

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `server/routes.ts` | A1–A6 (6 backend changes) |
| 2 | `client/src/pages/customer/Notifications.tsx` | B1–B6 (deep-links + icons) |
| 3 | `client/src/pages/customer/JobDetail.tsx` | F1–F3 (fix bug + pro rating + review CTA) |
| 4 | `client/src/pages/customer/Bookings.tsx` | H1 (leave review button) |
| 5 | `client/src/pages/pro/Bookings.tsx` | D1 (cancel booking button + mutation) |
| 6 | `client/src/pages/pro/JobFeed.tsx` | E2–E3 (quote badge + highlight param) |
| 7 | `client/src/pages/customer/Dashboard.tsx` | G1 (pro names in pipeline) |
| 8 | `client/src/pages/pro/Leads.tsx` | C1 (view feed link) |
| 9 | `implementation_report1.md` | Session 6 section append |

---

## Verification Plan

After implementation:
1. Build: `npm run build` — must pass with 0 TypeScript errors
2. Check backend changes compile correctly (server uses tsx, so TypeScript errors surfaced at build)
3. Verify notification fan-out: publish a draft job → check notifications API for pros with matching categories
4. Verify BOOKING_IN_PROGRESS: call in-progress endpoint → customer notification created
5. Verify quote card shows pro name + rating (from A4 fix)
6. Verify estimatedDuration shows correctly in quote cards (F1 fix)
7. Build succeeds → commit → push to GitHub → Vercel auto-deploys → verify live URL

---

## Implementation Order

Run in 3 parallel waves:
- **Wave 1 (parallel):** Backend routes.ts (A1-A6) + Notifications.tsx (B1-B6)  
- **Wave 2 (parallel, after Wave 1):** JobDetail.tsx (F1-F3) + Bookings.tsx customer (H1) + Pro Bookings (D1) + JobFeed.tsx (E2-E3)  
- **Wave 3 (parallel):** Dashboard.tsx (G1) + Pro Leads.tsx (C1) + implementation_report1.md update
