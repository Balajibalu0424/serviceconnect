import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/public/PublicShell";
import {
  CUSTOMER_ONBOARDING_PATH,
  PROFESSIONAL_ONBOARDING_PATH,
} from "@/lib/publicRoutes";
import {
  Sparkles,
  Zap,
  MessageSquare,
  CalendarCheck,
  Star,
  Shield,
  CreditCard,
  Users,
  ArrowRight,
  Briefcase,
  Wrench,
  CheckCircle2,
  Clock,
  BadgeCheck,
  Bot,
  HeartHandshake,
  FileText,
} from "lucide-react";

interface Step {
  n: string;
  title: string;
  desc: string;
  icon: any;
}

const CUSTOMER_STEPS: Step[] = [
  {
    n: "01",
    title: "Tell us what you need",
    desc: "Describe the job in a sentence or two — or let our AI assistant ask the right questions and write the brief for you. Add photos, a preferred date, and your Eircode.",
    icon: Sparkles,
  },
  {
    n: "02",
    title: "Verified pros respond",
    desc: "The moment your job goes live, matching professionals in your area are notified. Most jobs get their first response within a couple of hours — often faster.",
    icon: Zap,
  },
  {
    n: "03",
    title: "Compare quotes and chat",
    desc: "Review profiles, ratings, portfolios and written quotes side by side. Ask questions in the built-in chat before you commit to anyone.",
    icon: MessageSquare,
  },
  {
    n: "04",
    title: "Book and get it done",
    desc: "When you’re happy, accept the quote and confirm a date. Your pro shows up, the work gets done, and you mark the job complete from your dashboard.",
    icon: CalendarCheck,
  },
  {
    n: "05",
    title: "Review and follow up",
    desc: "Leave an honest review to help the next customer. Our aftercare flow checks in with you a few days later — so if anything went sideways, we can help fix it.",
    icon: Star,
  },
];

const PRO_STEPS: Step[] = [
  {
    n: "01",
    title: "Create your profile",
    desc: "Tell us your trade, service areas and typical prices. Upload a photo, a few examples of past work, and the credentials that prove you’re the real thing.",
    icon: Users,
  },
  {
    n: "02",
    title: "Get verified",
    desc: "We check phone and email, and review supporting documents where relevant. Verified pros get a badge customers actually look for before they hire.",
    icon: BadgeCheck,
  },
  {
    n: "03",
    title: "See matching jobs",
    desc: "New jobs in your categories and service areas show up in your feed instantly. You can matchbook the ones you like and unlock full contact details when you’re ready.",
    icon: Briefcase,
  },
  {
    n: "04",
    title: "Quote and win the job",
    desc: "Send a clear, written quote in seconds — the AI can suggest fair pricing based on the brief. Customers compare quotes side by side, so sharp, honest pricing wins.",
    icon: FileText,
  },
  {
    n: "05",
    title: "Deliver great work",
    desc: "Do the job, get paid directly by the customer, and earn a review. Strong reviews push you up the rankings for every matching job after that.",
    icon: HeartHandshake,
  },
];

const DIFFERENTIATORS = [
  {
    icon: Shield,
    title: "Real identity, real accountability",
    desc: "Verified phone, email and role checks on every account. Abusive or fake profiles are removed — and customers can report any message, review or professional in one tap.",
  },
  {
    icon: Bot,
    title: "AI that improves quality, not noise",
    desc: "Our assistant helps customers write clear briefs and helps pros price fairly. It flags fake, incomplete or off-platform-contact attempts before they waste anyone’s time.",
  },
  {
    icon: CreditCard,
    title: "Pros only pay for leads they want",
    desc: "No subscription lock-in. Professionals unlock the jobs they genuinely want to quote on — so customers get serious responses, not copy-paste templates.",
  },
  {
    icon: HeartHandshake,
    title: "Aftercare, not just a listing",
    desc: "We follow up after jobs complete. If something went wrong, we help put it right — which is why ServiceConnect feels more like a service and less like a directory.",
  },
];

const FAQS = [
  {
    q: "Does it cost anything to post a job?",
    a: "No. Posting a job on ServiceConnect is free for customers. You only pay the professional you choose to hire — directly, for the work they do.",
  },
  {
    q: "How fast will I hear back?",
    a: "Most jobs get their first quote within a couple of hours. Response time depends on trade and location, but urgent jobs are flagged to pros immediately.",
  },
  {
    q: "How do I know a professional is legit?",
    a: "Every professional goes through identity and contact verification. You can see ratings, reviews, portfolio photos and how long they’ve been on the platform before you commit.",
  },
  {
    q: "What if something goes wrong?",
    a: "Contact support from your dashboard at any time — our team reviews disputes and moderation reports directly. You can also report a specific message, review or professional in one tap.",
  },
  {
    q: "How do professionals pay for the platform?",
    a: "Pros use a credit system to unlock the full contact details of jobs they want to quote on. There’s no monthly fee, and they only spend credits on leads they actually choose.",
  },
];

export default function HowItWorks() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative px-6 pt-16 pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/70 via-background to-background dark:from-blue-950/30 pointer-events-none" />
        <div className="absolute top-16 left-1/4 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl" />
        <div className="absolute top-32 right-1/4 w-80 h-80 bg-violet-400/15 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-100/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <Sparkles className="w-3.5 h-3.5" />
            How ServiceConnect works
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Hiring someone local, <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">without the guesswork.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Post a job in minutes. Get real quotes from verified professionals near you. Compare,
            chat, book and review — all in one place, with aftercare built in.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href={CUSTOMER_ONBOARDING_PATH}>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 gap-2 rounded-xl">
                <Briefcase className="w-4 h-4" /> Post a job
              </Button>
            </Link>
            <Link href={PROFESSIONAL_ONBOARDING_PATH}>
              <Button size="lg" variant="outline" className="gap-2 rounded-xl border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                <Wrench className="w-4 h-4" /> Join as a pro
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">Free to post. No credit card. No spam.</p>
        </div>
      </section>

      {/* For customers */}
      <section className="px-6 py-20 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
              <Briefcase className="w-3.5 h-3.5" /> For customers
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Five steps from “I need someone” to “it’s done.”
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Whether it’s a leaky tap or a full kitchen refit, the flow is the same: describe the
              job, get real quotes, pick the pro you like, and follow the whole thing from your
              dashboard.
            </p>
          </div>

          <ol className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {CUSTOMER_STEPS.map((step) => (
              <li
                key={step.n}
                className="group relative p-6 rounded-2xl border border-border/60 bg-card/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
              >
                <div className="text-xs font-bold text-blue-600/80 tracking-wider mb-3">{step.n}</div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <step.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex justify-center">
            <Link href={CUSTOMER_ONBOARDING_PATH}>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 gap-2 rounded-xl">
                Post your first job <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* For pros */}
      <section className="px-6 py-20 bg-gradient-to-b from-violet-50/40 to-background dark:from-violet-950/20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-3">
              <Wrench className="w-3.5 h-3.5" /> For professionals
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Better leads. Fair pricing. Tools that respect your time.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              ServiceConnect is built to get serious customers in front of serious tradespeople. No
              endless subscription, no paying for cold leads — you unlock the jobs you actually
              want.
            </p>
          </div>

          <ol className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {PRO_STEPS.map((step) => (
              <li
                key={step.n}
                className="group relative p-6 rounded-2xl border border-border/60 bg-card/60 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg hover:shadow-violet-500/5 transition-all"
              >
                <div className="text-xs font-bold text-violet-600/80 tracking-wider mb-3">{step.n}</div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <step.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex justify-center">
            <Link href={PROFESSIONAL_ONBOARDING_PATH}>
              <Button size="lg" variant="outline" className="gap-2 rounded-xl border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                Join as a pro <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="px-6 py-20 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" /> Why ServiceConnect
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              What makes it different from a listings site.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Most marketplaces are optimised to sell leads. We’re optimised to get the job done
              well.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map((d) => (
              <div
                key={d.title}
                className="p-6 rounded-2xl border border-border/60 bg-card/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all flex gap-5"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <d.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold mb-1.5">{d.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20 bg-card/30 border-t border-border/40">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Clock className="w-3.5 h-3.5" /> Common questions
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Quick answers before you get started.
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5 rounded-2xl border border-border/60 bg-card/80 open:shadow-md transition-shadow">
                <summary className="flex items-center justify-between cursor-pointer select-none font-semibold text-base">
                  {f.q}
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform flex-shrink-0 ml-4" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="relative space-y-5">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Ready to get it done?</h2>
            <p className="text-blue-50/90 max-w-xl mx-auto text-lg">
              Post your first job free. Or join the platform as a professional and start winning
              better leads this week.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href={CUSTOMER_ONBOARDING_PATH}>
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl gap-2">
                  <Briefcase className="w-4 h-4" /> Post a job
                </Button>
              </Link>
              <Link href={PROFESSIONAL_ONBOARDING_PATH}>
                <Button size="lg" variant="outline" className="bg-transparent border-white/50 text-white hover:bg-white/10 rounded-xl gap-2">
                  <Wrench className="w-4 h-4" /> Join as a pro
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
