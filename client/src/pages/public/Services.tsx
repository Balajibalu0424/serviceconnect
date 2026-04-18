import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/public/PublicShell";
import {
  CUSTOMER_ONBOARDING_PATH,
  PROFESSIONAL_ONBOARDING_PATH,
} from "@/lib/publicRoutes";
import {
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen,
  Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator,
  Home as HomeIcon, Wand2, Briefcase, ArrowRight, Shield, MapPin,
  CheckCircle2, Bot, BadgeCheck, Building2,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen,
  Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator,
};

/**
 * Curated groups layered on top of whatever categories the API returns. The
 * cards pull live data (name, slug, description) from `/api/categories` when
 * available and fall back to a stable curated set below so the page is never
 * empty — even if the DB hasn't seeded yet.
 */
const GROUPS: Array<{
  key: string;
  title: string;
  blurb: string;
  icon: any;
  tone: string; // tailwind gradient
  slugs: string[];
  examples: string[];
}> = [
  {
    key: "home-repairs",
    title: "Home & repairs",
    blurb:
      "The trades you call first when something in the house needs fixing, fitting or replacing. Vetted local pros for jobs big and small.",
    icon: HomeIcon,
    tone: "from-blue-500 to-cyan-500",
    slugs: ["plumbing", "electrical", "handyman"],
    examples: [
      "Fix a leaking kitchen tap",
      "Install an electric shower",
      "Mount a TV and hide the cables",
      "Replace blown sockets and switches",
      "Bleed radiators and check the boiler",
    ],
  },
  {
    key: "finish",
    title: "Paint, finishes & interiors",
    blurb:
      "Refresh a room, paint the whole house, or plan a proper interior re-do. Professionals who treat finishes like a craft.",
    icon: Paintbrush,
    tone: "from-pink-500 to-rose-500",
    slugs: ["painting"],
    examples: [
      "Interior repaint for a three-bed",
      "Hallway and staircase feature wall",
      "Wallpaper hanging and removal",
      "Outdoor masonry and trim paint",
    ],
  },
  {
    key: "outdoor",
    title: "Garden & outdoor",
    blurb:
      "Tidy up, take back control, or redesign your garden from scratch. From one-off tidies to year-round maintenance.",
    icon: Leaf,
    tone: "from-emerald-500 to-green-500",
    slugs: ["gardening"],
    examples: [
      "One-off garden clearance",
      "Monthly lawn and hedge maintenance",
      "New lawn from scratch",
      "Fencing and decking repairs",
    ],
  },
  {
    key: "cleaning",
    title: "Cleaning & home care",
    blurb:
      "Deep cleans, end-of-tenancy, regular domestic cleaning — for tenants, homeowners and landlords.",
    icon: Sparkles,
    tone: "from-violet-500 to-purple-500",
    slugs: ["cleaning"],
    examples: [
      "End-of-tenancy clean for a two-bed",
      "Weekly domestic cleaning",
      "Pre-sale deep clean",
      "Office and workspace cleaning",
    ],
  },
  {
    key: "moves",
    title: "Moves & removals",
    blurb:
      "Short hops across town or a full house move — experienced movers, proper vans and upfront pricing.",
    icon: Truck,
    tone: "from-sky-500 to-blue-500",
    slugs: ["removals"],
    examples: [
      "One-bed apartment move across Dublin",
      "Three-bed house removal",
      "Single large item delivery",
      "Storage pickup and drop-off",
    ],
  },
  {
    key: "events",
    title: "Events, food & photography",
    blurb:
      "Private and small-business events handled by local professionals who do this every week.",
    icon: Camera,
    tone: "from-indigo-500 to-blue-500",
    slugs: ["catering", "photography"],
    examples: [
      "Family communion catering",
      "Corporate headshots for the team",
      "Wedding photography (full day)",
      "Private-home dinner for 10",
    ],
  },
  {
    key: "learning",
    title: "Tutoring & coaching",
    blurb:
      "Qualified tutors and coaches — in person or online. Junior Cert, Leaving Cert, languages, fitness and more.",
    icon: BookOpen,
    tone: "from-teal-500 to-cyan-500",
    slugs: ["tutoring", "personal-training"],
    examples: [
      "Leaving Cert maths grinds",
      "Weekly one-to-one fitness coaching",
      "Spoken Irish conversation practice",
      "Piano lessons for beginners",
    ],
  },
  {
    key: "pets",
    title: "Pet care",
    blurb:
      "Trusted local walkers, sitters and groomers. Small businesses, not anonymous gig workers.",
    icon: Heart,
    tone: "from-lime-500 to-green-500",
    slugs: ["pet-care"],
    examples: [
      "Daily dog walking",
      "Cat sitting while you travel",
      "Mobile grooming at your door",
      "Puppy training sessions",
    ],
  },
  {
    key: "auto",
    title: "Cars & auto repair",
    blurb:
      "Mechanics for servicing, pre-purchase checks and on-the-spot fixes. Many offer mobile call-outs.",
    icon: Car,
    tone: "from-zinc-500 to-slate-600",
    slugs: ["auto-repair"],
    examples: [
      "Full service and NCT prep",
      "Brake pad and disc replacement",
      "Pre-purchase inspection",
      "Battery and alternator diagnosis",
    ],
  },
  {
    key: "digital",
    title: "Design & digital",
    blurb:
      "Web designers, developers and creatives — ideal for small businesses that want their online presence to actually work.",
    icon: Globe,
    tone: "from-fuchsia-500 to-pink-500",
    slugs: ["web-design"],
    examples: [
      "New small-business website",
      "Shopify store setup",
      "Booking system on an existing site",
      "Brand logo and stationery",
    ],
  },
  {
    key: "pro",
    title: "Legal & accounting",
    blurb:
      "Professional services for individuals, freelancers and SMEs — clear pricing, no jargon.",
    icon: Scale,
    tone: "from-slate-500 to-gray-600",
    slugs: ["legal", "accounting"],
    examples: [
      "Year-end accounts for a sole trader",
      "Conveyancing for a house purchase",
      "Employment contract review",
      "VAT registration and advice",
    ],
  },
  {
    key: "business",
    title: "Small business & workspace",
    blurb:
      "Keep a shop, office or workspace running. From one-off fit-outs to regular maintenance rounds.",
    icon: Building2,
    tone: "from-orange-500 to-amber-500",
    slugs: ["cleaning", "electrical", "handyman"],
    examples: [
      "Weekly office cleaning",
      "Retail shop fit-out",
      "Server/networking cabling",
      "Signage install and repair",
    ],
  },
];

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}

export default function Services() {
  const { data: categories = [] } = useQuery<ApiCategory[]>({ queryKey: ["/api/categories"] });

  // Map slug -> category (so GROUPS.slugs can resolve to a real id/name/desc).
  const bySlug = new Map<string, ApiCategory>();
  for (const c of categories) bySlug.set(c.slug, c);

  const allCount = categories.length;

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative px-6 pt-16 pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/70 via-background to-background dark:from-blue-950/30 pointer-events-none" />
        <div className="absolute top-16 left-1/4 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl" />
        <div className="absolute top-32 right-1/4 w-80 h-80 bg-violet-400/15 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-100/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <MapPin className="w-3.5 h-3.5" />
            Local services, across Ireland
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Every local service you actually need,{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">in one trusted place.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            From a quick plumbing fix to a full kitchen refit — post the job once, compare verified
            professionals near you, and get it done.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href={CUSTOMER_ONBOARDING_PATH}>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 gap-2 rounded-xl">
                <Briefcase className="w-4 h-4" /> Post a job
              </Button>
            </Link>
            <Link href={PROFESSIONAL_ONBOARDING_PATH}>
              <Button size="lg" variant="outline" className="gap-2 rounded-xl border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                <Wrench className="w-4 h-4" /> Offer your services
              </Button>
            </Link>
          </div>
          {allCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {allCount}+ service categories currently available on ServiceConnect.
            </p>
          )}
        </div>
      </section>

      {/* Curated groups */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Browse by what you need
              </h2>
              <p className="text-muted-foreground mt-1">
                Not sure what to search for? Start from the group that best describes your job.
              </p>
            </div>
            <Link href={CUSTOMER_ONBOARDING_PATH}>
              <Button variant="ghost" className="gap-1.5 text-sm">
                Or just post a job <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {GROUPS.map((g) => {
              const resolved = g.slugs.map((s) => bySlug.get(s)).filter(Boolean) as ApiCategory[];
              return (
                <div
                  key={g.key}
                  className="group relative p-6 rounded-2xl border border-border/60 bg-card/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all flex flex-col"
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.tone} flex items-center justify-center mb-4 shadow-md`}
                  >
                    <g.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold">{g.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{g.blurb}</p>

                  {/* Example jobs */}
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {g.examples.slice(0, 4).map((ex) => (
                      <li key={ex} className="flex items-start gap-2 text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Live categories in this group */}
                  {resolved.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {resolved.map((c) => (
                        <Link key={c.id} href={`/post-job?category=${c.id}`}>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer transition-colors">
                            {c.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-5">
                    <Link href={CUSTOMER_ONBOARDING_PATH}>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
                        Start a job in {g.title.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full A-Z (live categories) */}
      {categories.length > 0 && (
        <section className="px-6 py-16 bg-card/30 border-y border-border/40">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                All services on ServiceConnect
              </h2>
              <p className="text-muted-foreground mt-1">
                Tap a category to post a job in that trade.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((cat) => {
                  const Icon = ICON_MAP[cat.icon ?? ""] || Wrench;
                  return (
                    <Link key={cat.id} href={`/post-job?category=${cat.id}`}>
                      <div className="h-full p-4 rounded-xl border border-border/60 bg-card/80 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer group flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
                          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{cat.name}</div>
                          {cat.description && (
                            <div className="text-xs text-muted-foreground truncate">{cat.description}</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-5">
          {[
            { icon: BadgeCheck, title: "Verified professionals", desc: "Every pro has their contact details and credentials verified before they can quote." },
            { icon: Bot, title: "AI quality checks", desc: "Our assistant flags fake briefs, off-platform contact attempts and poor-fit matches." },
            { icon: Shield, title: "Moderation built-in", desc: "Report any message, review or profile in one tap. A human on our team reviews it." },
          ].map((item) => (
            <div key={item.title} className="p-5 rounded-2xl border border-border/60 bg-card/70 flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-bold text-sm">{item.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dual CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
                <Briefcase className="w-3.5 h-3.5" /> For customers
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold">Have a job in mind? Post it free.</h3>
              <p className="text-blue-50/90 text-sm leading-relaxed">
                Get real quotes from verified professionals in your area. No card details. No spam.
              </p>
              <Link href={CUSTOMER_ONBOARDING_PATH}>
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl gap-2 mt-2">
                  <Wand2 className="w-4 h-4" /> Post a job
                </Button>
              </Link>
            </div>
          </div>
          <div className="p-8 rounded-3xl border border-border/60 bg-card/70 relative overflow-hidden">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                <Wrench className="w-3.5 h-3.5" /> For professionals
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold">Run a trade? Start getting better leads.</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Pay only for the jobs you actually want to quote on. Build ratings that move you up
                the feed.
              </p>
              <Link href={PROFESSIONAL_ONBOARDING_PATH}>
                <Button size="lg" variant="outline" className="rounded-xl gap-2 mt-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                  Join as a pro <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
