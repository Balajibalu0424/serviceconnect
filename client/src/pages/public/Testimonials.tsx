import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/public/PublicShell";
import {
  CUSTOMER_ONBOARDING_PATH,
  PROFESSIONAL_ONBOARDING_PATH,
} from "@/lib/publicRoutes";
import {
  Star, Shield, BadgeCheck, Bot, HeartHandshake, MessageSquare,
  Briefcase, Wrench, ArrowRight, Quote, Sparkles, CheckCircle2,
  Lock, Flag,
} from "lucide-react";

interface Testimonial {
  id: string;
  rating: number;
  comment: string;
  name: string;
  createdAt: string;
}
interface TestimonialsResponse {
  count: number;
  items: Testimonial[];
}

/**
 * When there are genuinely no approved reviews yet, we show a clearly-labelled
 * "What early users are telling us to aim for" section — explicit beta
 * expectations, not invented quotes attributed to fictional people.
 */
const BETA_PILLARS: Array<{
  title: string;
  desc: string;
  icon: any;
}> = [
  {
    title: "Real people on both sides",
    desc: "Every professional and customer verifies their identity and contact details before they can post, quote or hire. No anonymous reviews, no fake profiles.",
    icon: BadgeCheck,
  },
  {
    title: "Quotes that actually make sense",
    desc: "Our AI assistant helps customers write clearer briefs and helps professionals price fairly — so the quotes you get aren't one-line copy-pastes.",
    icon: Bot,
  },
  {
    title: "Moderation you can see working",
    desc: "Report a message, review or professional in one tap. A human on our team reviews every report. Repeat offenders are removed.",
    icon: Shield,
  },
  {
    title: "Aftercare, not just a marketplace",
    desc: "We check in after jobs complete. If something went wrong, we help fix it — which is why ServiceConnect feels more like a service than a directory.",
    icon: HeartHandshake,
  },
];

function StarRow({ rating }: { rating: number }) {
  const full = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < full
              ? "w-4 h-4 fill-amber-400 text-amber-400"
              : "w-4 h-4 text-muted-foreground/30"
          }
        />
      ))}
    </div>
  );
}

export default function Testimonials() {
  const { data, isLoading } = useQuery<TestimonialsResponse>({
    queryKey: ["/api/public/testimonials"],
  });

  const items = data?.items ?? [];
  const hasRealReviews = !isLoading && items.length > 0;
  const realCount = items.length;

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative px-6 pt-16 pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/70 via-background to-background dark:from-blue-950/30 pointer-events-none" />
        <div className="absolute top-16 left-1/4 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl" />
        <div className="absolute top-32 right-1/4 w-80 h-80 bg-violet-400/15 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-100/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <Quote className="w-3.5 h-3.5" />
            Honest feedback from real users
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            We’d rather earn your trust{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">than fake it.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            ServiceConnect is a young platform. We only show reviews from real,
            completed jobs — not invented testimonials with stock photos. Here’s exactly what we
            have, and what we’re building towards.
          </p>
        </div>
      </section>

      {/* Real reviews block, only rendered if any exist */}
      <section className="px-6 pb-4">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-48 rounded-2xl border border-border/60 bg-card/50 animate-pulse" />
              ))}
            </div>
          ) : hasRealReviews ? (
            <>
              <div className="flex items-end justify-between mb-6 gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified reviews from completed jobs
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                    What customers said after the work was done.
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Showing {realCount} {realCount === 1 ? "review" : "reviews"} rated 4★ or higher.
                    Names are shortened to protect reviewer privacy.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="p-6 rounded-2xl border border-border/60 bg-card/70 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all flex flex-col"
                  >
                    <StarRow rating={t.rating} />
                    <blockquote className="mt-3 text-sm text-foreground leading-relaxed">
                      “{t.comment}”
                    </blockquote>
                    <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center text-[11px] font-bold text-blue-700 dark:text-blue-300">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground/60">·</span>
                      <span>Verified customer</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // No real reviews yet — don't pretend we do.
            <div className="max-w-3xl mx-auto rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Lock className="w-3.5 h-3.5" /> Beta transparency
              </div>
              <h3 className="text-xl md:text-2xl font-bold mt-3">
                No approved public reviews yet — and we won’t invent them.
              </h3>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                ServiceConnect is in its early stages. As jobs complete and customers leave 4★+
                reviews, the verified reviews they write will appear here automatically. In the
                meantime, below is exactly what we’re holding ourselves to.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* What we're building towards / trust pillars */}
      <section className="px-6 py-16 mt-4 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              {hasRealReviews ? "Why early users keep coming back" : "What early users are telling us to aim for"}
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              The four things ServiceConnect has to get right.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              These aren’t slogans — they’re the standards the product is built against.
              If we ever fall short on any of them, tell us and we’ll fix it.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {BETA_PILLARS.map((p) => (
              <div key={p.title} className="p-6 rounded-2xl border border-border/60 bg-card/60 flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <p.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold mb-1.5">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why users trust */}
      <section className="px-6 py-16 bg-card/30 border-y border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Shield className="w-3.5 h-3.5" /> Trust, in practice
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              How we keep the marketplace clean.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We’d rather have fewer, higher-quality reviews than a wall of glowing nonsense.
              Here’s what that looks like day to day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-border/60 bg-card/80">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Reviews only from completed jobs
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                You can’t leave a review without a real booking that was marked complete. That rules
                out most of the fake-review problem at the source.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-border/60 bg-card/80">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Flag className="w-4 h-4 text-rose-500" /> Report anything in one tap
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Any message, review or profile can be reported. A human on our trust & safety team
                reviews every report, usually within a business day.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-border/60 bg-card/80">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="w-4 h-4 text-blue-500" /> Right of reply for pros
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Professionals can respond to every review publicly, so a one-sided account is never
                the final word. Disputes go to our team, not to a bot.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="relative space-y-5">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Try ServiceConnect, then tell us how we did.
            </h2>
            <p className="text-blue-50/90 max-w-xl mx-auto text-lg">
              Post your first job free, or join as a professional. Every honest review —
              good or bad — helps us earn the trust the next customer is deciding whether to give us.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href={CUSTOMER_ONBOARDING_PATH}>
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl gap-2">
                  <Briefcase className="w-4 h-4" /> Post a job
                </Button>
              </Link>
              <Link href={PROFESSIONAL_ONBOARDING_PATH}>
                <Button size="lg" variant="outline" className="bg-transparent border-white/50 text-white hover:bg-white/10 rounded-xl gap-2">
                  <Wrench className="w-4 h-4" /> Join as a pro <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
