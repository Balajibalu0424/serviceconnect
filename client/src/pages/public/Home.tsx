import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen,
  Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator,
  ArrowRight, Shield, Star, Users, CheckCircle, Clock, ThumbsUp,
  TrendingUp, Lock, BadgeCheck, Phone, MessageCircle, Zap as ZapIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ICON_MAP: Record<string, any> = {
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen,
  Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator
};

// Blurred mock pro cards for social proof
const MOCK_PROS = [
  { name: "D. Walsh", trade: "Plumber", rating: "4.9", reviews: 47, badge: "Top Pro", years: 12, response: "< 1 hr" },
  { name: "S. Brennan", trade: "Electrician", rating: "4.8", reviews: 31, badge: "Verified", years: 8, response: "< 2 hrs" },
  { name: "P. Connolly", trade: "Painter", rating: "5.0", reviews: 62, badge: "Top Pro", years: 15, response: "< 1 hr" },
  { name: "M. O'Brien", trade: "Cleaner", rating: "4.7", reviews: 89, badge: "Verified", years: 5, response: "< 3 hrs" },
];

const TRUST_STATS = [
  { value: "2,500+", label: "Verified professionals", icon: BadgeCheck },
  { value: "18,000+", label: "Jobs completed", icon: CheckCircle },
  { value: "< 2 hrs", label: "Avg. first response", icon: Clock },
  { value: "4.8 / 5", label: "Average pro rating", icon: Star },
];

const HOW_IT_WORKS_CUSTOMER = [
  { step: "1", title: "Post your job — free", desc: "Describe what you need in under 60 seconds. No account needed to start." },
  { step: "2", title: "Pros compete for you", desc: "Vetted local professionals send competitive quotes directly to you." },
  { step: "3", title: "Pick & get it done", desc: "Choose the best quote, chat, book — and get your job sorted." },
];

const HOW_IT_WORKS_PRO = [
  { step: "1", title: "Browse real leads", desc: "See live jobs in your area. Every lead is AI quality-screened — no junk." },
  { step: "2", title: "Unlock when interested", desc: "Use credits to see full details and contact info. Pay only for what you want." },
  { step: "3", title: "Win the job", desc: "Chat, quote, close — and build your reputation on your terms." },
];

const TRUST_BADGES = [
  { icon: Shield, label: "AI quality gate", desc: "Every job is screened before going live" },
  { icon: BadgeCheck, label: "Verified pros only", desc: "ID-checked, reviewed, rated" },
  { icon: Lock, label: "Credits never expire", desc: "Unlike other platforms — yours to keep" },
  { icon: ThumbsUp, label: "Aftercare follow-up", desc: "We check in until the job is sorted" },
];

export default function Home() {
  const { user } = useAuth();
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const dashboardLink = user?.role === "PROFESSIONAL" ? "/pro/dashboard"
    : user?.role === "ADMIN" ? "/admin"
    : user ? "/dashboard" : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg">ServiceConnect</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={dashboardLink!}><Button size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link href="/register"><Button variant="outline" size="sm" className="hidden sm:inline-flex">Join as a Pro</Button></Link>
                <Link href="/post-job"><Button size="sm">Post a Job Free</Button></Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/8 via-background to-primary/4 py-20 px-4">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 left-20 w-48 h-48 rounded-full bg-primary/4 blur-2xl" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-5 bg-primary/10 text-primary border-primary/20 px-3 py-1">
              Dublin's fairest service marketplace
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 tracking-tight leading-tight">
              Find a trusted pro.<br />
              <span className="text-primary">Pay only when they deliver.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Post any job for free. Get competitive quotes from vetted local professionals.
              No fake leads. No credits that expire. No nonsense.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/post-job">
                <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
                  Post a Job — it's free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 w-full sm:w-auto">
                  Join as a Professional
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No account needed to post a job · Free forever for customers
            </p>
          </div>

          {/* Blurred pro cards — teaser for account creation */}
          <div className="relative mt-6">
            <div className="text-center mb-4">
              <p className="text-sm font-medium text-muted-foreground">
                Professionals ready to quote in your area
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {MOCK_PROS.map((pro) => (
                <Card key={pro.name} className="relative overflow-hidden border-border/60">
                  <CardContent className="p-3 text-center">
                    {/* Avatar circle */}
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-sm font-bold text-primary">{pro.name[0]}</span>
                    </div>
                    <p className="font-semibold text-sm">{pro.trade}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium">{pro.rating}</span>
                      <span className="text-xs text-muted-foreground">({pro.reviews})</span>
                    </div>
                    {/* Blurred details — unlock teaser */}
                    <div className="mt-2 relative">
                      <div className="blur-sm select-none">
                        <p className="text-xs text-muted-foreground">{pro.name}</p>
                        <p className="text-xs text-muted-foreground">Responds {pro.response}</p>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-1 bg-background/90 rounded px-1.5 py-0.5 border border-border text-xs text-muted-foreground">
                          <Lock className="w-2.5 h-2.5" /> Sign up
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="mt-2 text-[10px] px-1.5 py-0"
                    >
                      {pro.badge}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-3">
              <Link href="/register">
                <Button variant="link" size="sm" className="text-primary text-sm">
                  Create a free account to see full profiles →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust stats bar */}
      <section className="py-10 border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {TRUST_STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <stat.icon className="w-5 h-5 text-primary mb-1" />
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">What do you need done?</h2>
            <p className="text-muted-foreground text-sm">Post a job in any category — professionals in your area will respond</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {(categories as any[]).map((cat: any) => {
              const Icon = ICON_MAP[cat.icon] || Wrench;
              return (
                <Link key={cat.id} href={`/post-job?category=${cat.id}`}>
                  <Card className="hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all cursor-pointer group">
                    <CardContent className="p-3 text-center">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-xs font-medium leading-tight">{cat.name}</div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why ServiceConnect vs Bark */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
              A fairer way to find help
            </Badge>
            <h2 className="text-2xl font-bold mb-3">We fixed what other platforms get wrong</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pros on other platforms pay for leads from customers who never respond.
              ServiceConnect profits only when real jobs get done.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRUST_BADGES.map(({ icon: Icon, label, desc }) => (
              <Card key={label} className="border-border/70">
                <CardContent className="pt-5 pb-5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="font-semibold text-sm mb-1">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-2 gap-12">
            {/* Customer side */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">For Customers</h3>
                <Badge variant="secondary" className="text-xs">Always free</Badge>
              </div>
              {HOW_IT_WORKS_CUSTOMER.map(s => (
                <div key={s.step} className="flex gap-4 mb-5">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{s.desc}</div>
                  </div>
                </div>
              ))}
              <Link href="/post-job">
                <Button className="mt-2 gap-2 w-full sm:w-auto">
                  Post a job now <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            {/* Pro side */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-semibold text-lg">For Professionals</h3>
                <Badge variant="secondary" className="text-xs">Real leads only</Badge>
              </div>
              {HOW_IT_WORKS_PRO.map(s => (
                <div key={s.step} className="flex gap-4 mb-5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{s.desc}</div>
                  </div>
                </div>
              ))}
              <Link href="/register">
                <Button variant="outline" className="mt-2 gap-2 w-full sm:w-auto">
                  Join as a professional <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof — review snippets */}
      <section className="py-14 px-4 bg-muted/20 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">What people are saying</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { quote: "Posted a plumbing job at 9am, had three quotes by lunchtime. Fixed that afternoon. Brilliant.", name: "Alice M.", location: "Ranelagh, Dublin 6", stars: 5 },
              { quote: "Finally a platform where the leads are real. I've converted 4 out of 5 jobs I've unlocked.", name: "Dermot W.", location: "Plumber, Dublin", stars: 5, isPro: true },
              { quote: "Loved that I didn't have to create an account just to post. Got sorted with a cleaner in a day.", name: "Bob K.", location: "Clontarf, Dublin 3", stars: 5 },
            ].map((r, i) => (
              <Card key={i} className="border-border/70">
                <CardContent className="pt-5 pb-5">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: r.stars }).map((_, s) => (
                      <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground mb-3 leading-relaxed">"{r.quote}"</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{r.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.location}</p>
                    </div>
                    {r.isPro && <Badge variant="secondary" className="ml-auto text-[10px]">Pro</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to get your job sorted?</h2>
          <p className="text-muted-foreground mb-8">
            Post a job in 60 seconds. Free forever for customers. Real professionals, real quotes, real results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/post-job">
              <Button size="lg" className="gap-2 px-8 w-full sm:w-auto">
                Post a Job Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="gap-2 px-8 w-full sm:w-auto">
                Join as a Professional
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-card">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm text-muted-foreground">ServiceConnect Ireland © 2025</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/post-job" className="hover:text-foreground transition-colors">Post a Job</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">For Professionals</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Log in</Link>
          </div>
          <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Created with Perplexity Computer
          </a>
        </div>
      </footer>
    </div>
  );
}
