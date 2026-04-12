# ServiceConnect — Major Product Enhancement Plan

## Executive Summary
Comprehensive upgrade covering notifications, UX, workflow logic, and dashboards for both Customer and Professional roles. No schema changes required — all improvements use existing tables. ~8 focused phases, sequenced by risk (backend-only first, then frontend).

---

## Phase A — Backend: Missing Notification Calls (server/routes.ts)

### A1 — QUOTE_REJECTED → pro notification (line ~1364)
After `db.update(quotes).set({ status: "REJECTED" })`, add:
```ts
await createNotification(quote.professionalId, "QUOTE_REJECTED",
  "Your quote was not accepted",
  "The customer has declined your quote for this job.",
  { quoteId: quote.id, jobId: quote.jobId });
```

### A2 — REVIEW_POSTED → pro notification (line ~1488)
Before `return res.status(201).json(review)` in review POST, add:
```ts
await createNotification(revieweeId, "REVIEW_POSTED",
  "You received a new review",
  `A customer rated you ${reviewData.rating} star${reviewData.rating !== 1 ? "s" : ""}.`,
  { reviewId: review.id, bookingId: booking.id, jobId: booking.jobId });
```

### A3 — BOOKING_CREATED → pro notification (line ~1332)
After quote-acceptance transaction creates booking, add:
```ts
await createNotification(quote.professionalId, "BOOKING_CREATED",
  "Booking confirmed!",
  "A booking has been created. You can now begin work.",
  { bookingId: createdBookingId, jobId: quote.jobId });
```
Capture `createdBookingId` from the transaction's `.returning()` result.

### A4 — BOOKING_COMPLETED → both parties (line ~1426)
After booking status set to COMPLETED, notify both. Skip the caller:
```ts
if (req.user!.userId !== booking.professionalId) {
  await createNotification(booking.professionalId, "BOOKING_COMPLETED", ...);
}
if (req.user!.userId !== booking.customerId) {
  await createNotification(booking.customerId, "BOOKING_COMPLETED", ...);
}
```

### A5 — BOOKING_CANCELLED → both parties (line ~1437)
Same pattern as A4 but for cancellation event.

---

## Phase B — Pro Notification Page + Nav Link

### B1 — New file: `client/src/pages/pro/Notifications.tsx`
Single line re-export (the customer component is already fully role-aware):
```tsx
export { default } from "@/pages/customer/Notifications";
```

### B2 — Add new notification types to `customer/Notifications.tsx`
In `NOTIFICATION_ICONS` map, add:
- `QUOTE_REJECTED` → XCircle, red
- `REVIEW_POSTED` → Star, yellow
- `BOOKING_CREATED` → CalendarCheck, emerald
- `BOOKING_COMPLETED` → CheckCircle2, emerald
- `BOOKING_CANCELLED` → AlertTriangle, red

In `getNotificationLink()`, add cases:
- `QUOTE_REJECTED` → `/pro/leads`
- `REVIEW_POSTED` → `/pro/profile`
- `BOOKING_CREATED` / `BOOKING_COMPLETED` / `BOOKING_CANCELLED` → `/pro/bookings` (pro) or `/bookings` (customer)

Add these types to the "JOB_UPDATE" filter group.

### B3 — Route in `App.tsx`
```tsx
import ProNotifications from "@/pages/pro/Notifications";
<Route path="/pro/notifications">
  <ProtectedRoute roles={["PROFESSIONAL"]}><ProNotifications /></ProtectedRoute>
</Route>
```

### B4 — Nav link in `DashboardLayout.tsx`
In `ProNav()` array, add after "Messages":
```ts
{ label: "Notifications", href: "/pro/notifications", icon: Bell },
```
The existing badge-rendering logic already shows the unread count for any nav item labeled "Notifications".

---

## Phase C — Pro Profile: Service Category Picker

**File:** `client/src/pages/pro/ProfileEditor.tsx`

1. Add query: `useQuery<any[]>({ queryKey: ["/api/categories"] })`
2. Add state: `const [selectedCategories, setSelectedCategories] = useState<string[]>([])`
3. In the profile `useEffect`, also populate: `setSelectedCategories(profile.serviceCategories || [])`
4. In `updateProfile` mutationFn, add `serviceCategories: selectedCategories` to the PATCH body
5. Add a new Card section after "Professional Setup":
   - Title: "Service Categories"
   - Flex-wrap grid of toggle-style Buttons (default = selected, outline = unselected)
   - Click toggles the ID in/out of `selectedCategories`
   - Show "X categories selected" count badge
   - The existing "Save Business Info" button saves these along with other fields

---

## Phase D — Pro Bookings: Mark Complete Action

**File:** `client/src/pages/pro/Bookings.tsx`

1. Add `markComplete` mutation calling `POST /api/bookings/:id/complete`
2. In the booking detail Dialog, show "Mark Complete" button when `selectedBooking.status === "IN_PROGRESS"`
3. On success, invalidate bookings query and update dialog state to COMPLETED

---

## Phase E — Customer Dashboard: Actions Required + Quote Counts

**File:** `client/src/pages/customer/Dashboard.tsx`

1. Add `useQuery` for `/api/quotes`
2. Compute `pendingQuotes = allQuotes.filter(q => q.status === "PENDING")`
3. Add "Actions Required" banner card (only when pendingQuotes.length > 0 or unread notifs > 0):
   - "X quotes awaiting your decision" → links to `/my-jobs`
   - "X unread notifications" → links to `/notifications`
4. Enrich job pipeline cards with a pending-quote count badge per job

---

## Phase F — Pro Dashboard: Notification Badge + Category Setup Banner

**File:** `client/src/pages/pro/Dashboard.tsx`

1. Add `useQuery` for `/api/notifications` to get `unreadCount`
2. Add a "Notifications" stat card (Bell icon, links to `/pro/notifications`)
3. Add `useQuery` for `/api/pro/profile`
4. Show "Set up your trade categories" amber banner when `profile.serviceCategories` is empty, linking to `/pro/profile`

---

## Phase G — Job Feed: Sort + Urgency Filter + URL-Persisted Category

**File:** `client/src/pages/pro/JobFeed.tsx`

1. Add `sortBy` state (`"newest" | "budget_high" | "interested"`)
2. Add `urgencyFilter` state (`"all" | "URGENT" | "HIGH" | "NORMAL"`)
3. Apply client-side sort after existing filteredJobs computation
4. Add urgency filter pills UI below category selector
5. Add sort `Select` dropdown next to category filter
6. Persist `categoryFilter` in URL using `useSearch` + `setLocation` (same pattern as Chat.tsx)

---

## Phase H — UI/UX Polish

1. **Pro Bookings**: Replace spinner with skeleton card loaders matching the card shape
2. **Pro Bookings**: Better empty state (icon, heading, subtext, CTA → job feed)
3. **Customer JobDetail**: Toast on reject → "The professional will be notified."
4. **Customer MyJobs**: Add quote count badge on job cards (pending quotes only)
5. **Notification icons**: Ensure all new types have proper Lucide icons
6. **Pro ProfileEditor**: Bio character counter (show `{form.bio.length}/500` chars)
7. **All pages**: Ensure loading states use skeletons not just spinner text

---

## Files to Create
- `client/src/pages/pro/Notifications.tsx` (new, 1-line re-export)

## Files to Modify
- `server/routes.ts` — 5 notification additions (~40 lines total)
- `client/src/pages/customer/Notifications.tsx` — add icon types + routes (~25 lines)
- `client/src/App.tsx` — 1 import + 4-line route block
- `client/src/components/layouts/DashboardLayout.tsx` — 1 nav item
- `client/src/pages/pro/ProfileEditor.tsx` — category picker section
- `client/src/pages/pro/Bookings.tsx` — mark complete button + mutation
- `client/src/pages/pro/Dashboard.tsx` — notification stat card + banners
- `client/src/pages/pro/JobFeed.tsx` — sort + filter + URL persistence
- `client/src/pages/customer/Dashboard.tsx` — actions required + quote counts
- `client/src/pages/customer/JobDetail.tsx` — toast improvement

## No Schema Changes Required
All improvements use existing tables. `notifications`, `bookings`, `quotes`, `professionalProfiles` tables already support everything needed.

## Deployment
After all phases: `npm run build` → verify clean → `git push origin main` → Vercel auto-deploys → run `npx drizzle-kit push` (expect "No changes detected").
