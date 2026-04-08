import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Star, Shield, Zap, Users, CheckCircle2,
  Sparkles, Award, Clock, TrendingUp, ChevronRight,
  Wrench, Paintbrush, Leaf, LightbulbIcon, Scissors,
  Camera, GraduationCap, Dumbbell, Scale, Calculator,
  Truck, UtensilsCrossed, Dog, Car, Monitor, Dices, Briefcase
} from "lucide-react";

const CATEGORIES = [
  { name: "Plumbing", icon: Wrench, color: "from-blue-500 to-cyan-500" },
  { name: "Electrical", icon: LightbulbIcon, color: "from-amber-500 to-orange-500" },
  { name: "Painting", icon: Paintbrush, color: "from-pink-500 to-rose-500" },
  { name: "Gardening", icon: Leaf, color: "from-emerald-500 to-green-500" },
  { name: "Cleaning", icon: Sparkles, color: "from-violet-500 to-purple-500" },
  { name: "Photography", icon: Camera, color: "from-indigo-500 to-blue-500" },
  { name: "Tutoring", icon: GraduationCap, color: "from-teal-500 to-cyan-500" },
  { name: "Personal Training", icon: Dumbbell, color: "from-red-500 to-orange-500" },
  { name: "Web Design", icon: Monitor, color: "from-fuchsia-500 to-pink-500" },
  { name: "Removals", icon: Truck, color: "from-sky-500 to-blue-500" },
  { name: "Catering", icon: UtensilsCrossed, color: "from-yellow-500 to-amber-500" },
  { name: "Pet Care", icon: Dog, color: "from-lime-500 to-green-500" },
  { name: "Legal", icon: Scale, color: "from-slate-500 to-gray-600" },
  { name: "Accounting", icon: Calculator, color: "from-cyan-500 to-teal-500" },
  { name: "Handyman", icon: Scissors, color: "from-orange-500 to-red-500" },
  { name: "Auto Repair", icon: Car, color: "from-zinc-500 to-slate-600" },
];

const STATS = [
  { value: "10,000+", label: "Jobs Posted", icon: TrendingUp },
  { value: "2,500+", label: "Verified Pros", icon: Users },
  { value: "4.8/5", label: "Average Rating", icon: Star },
  { value: "<2hrs", label: "Avg Response", icon: Clock },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Post Your Job", desc: "Describe what you need — our AI helps you write the perfect brief in seconds.", icon: Sparkles },
  { step: "02", title: "Get Matched", desc: "Verified pros in your area are instantly notified and compete for your business.", icon: Zap },
  { step: "03", title: "Compare & Hire", desc: "Review profiles, ratings, and AI-suggested quotes. Choose the best fit.", icon: CheckCircle2 },
];

const TESTIMONIALS = [
  { name: "Sarah M.", role: "Homeowner, Dublin", text: "Found an incredible plumber within 30 minutes. The AI quality scoring means you only get serious, detailed responses.", rating: 5 },
  { name: "James O.", role: "Pro Electrician", text: "ServiceConnect's credit system is fair — I only pay for leads I actually want. The AI even suggests my quote pricing!", rating: 5 },
  { name: "Lisa K.", role: "Business Owner, Cork", text: "We use it for all our office maintenance. The aftercare follow-ups are brilliant — no other platform does that.", rating: 5 },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/80 dark:bg-gray-950/80 border-b border-white/20 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">ServiceConnect</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#categories" className="hover:text-foreground transition-colors">Services</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm font-medium">Sign In</Button>
            </Link>
            <Link href="/register?role=PROFESSIONAL">
              <Button variant="outline" size="sm" className="text-sm font-medium hidden sm:flex gap-1.5 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                <Wrench className="w-3.5 h-3.5" /> I'm a Pro
              </Button>
            </Link>
            <Link href="/register?role=CUSTOMER">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 text-sm font-medium gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Post a Job
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-background to-background dark:from-blue-950/30" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-violet-400/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — Copy */}
          <div className="space-y-8">
            <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-0 px-3 py-1.5 text-xs font-semibold gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Marketplace
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Find Trusted
              <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
                Local Pros
              </span>
              in Minutes
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              Ireland's smartest service marketplace. Post your job for free, get matched with verified
              professionals, and hire with confidence — all powered by AI.
            </p>

            {/* Two clear entry paths matching flowchart */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Customer path */}
              <Link href="/register?role=CUSTOMER">
                <div className="group p-5 rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow">
                      <Briefcase className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="font-bold text-sm">I need a Pro</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Post your job free. Get matched with verified local professionals.</p>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Post a job <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
              {/* Pro path */}
              <Link href="/register?role=PROFESSIONAL">
                <div className="group p-5 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 transition-all cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
                      <Wrench className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="font-bold text-sm">I'm a Professional</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Find local leads, unlock contact details with credits, grow your business.</p>
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Join as a Pro <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Verified pros</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>AI quality scored</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Free to post</span>
              </div>
            </div>
          </div>

          {/* Right — Hero Image */}
          <div className="relative lg:pl-8">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-white/20">
              <img
                src="/images/hero-services.png"
                alt="Professional home service providers"
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </div>

            {/* Floating glassmorphism cards */}
            <div className="absolute -bottom-6 -left-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/30 dark:border-gray-700/30 animate-float" style={{ animationDuration: "6s" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">Job Completed!</p>
                  <p className="text-xs text-muted-foreground">Kitchen plumbing · 5★</p>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/30 dark:border-gray-700/30 animate-float" style={{ animationDuration: "5s", animationDelay: "1s" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">AI Enhanced</p>
                  <p className="text-xs text-muted-foreground">Quality score: 94/100</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ──────────────────────────────────────────── */}
      <section className="py-12 border-y border-border/50 bg-gradient-to-r from-blue-50/50 via-white to-violet-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center group">
              <stat.icon className="w-6 h-6 mx-auto mb-2 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              <p className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-0 px-3 py-1 text-xs font-semibold mb-4">Simple Process</Badge>
            <h2 className="text-4xl font-extrabold tracking-tight">How ServiceConnect Works</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Three simple steps to find the perfect professional for any job.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="relative group">
                <div className="bg-card border border-border/50 rounded-2xl p-8 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">{item.step}</div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────── */}
      <section id="categories" className="py-24 px-6 bg-gradient-to-b from-background via-blue-50/30 to-background dark:from-gray-950 dark:via-gray-900/50 dark:to-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-0 px-3 py-1 text-xs font-semibold mb-4">16 Service Categories</Badge>
            <h2 className="text-4xl font-extrabold tracking-tight">Every Service You Need</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">From emergency plumbing to web design — find verified professionals for any job.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => (
              <Link key={cat.name} href="/register?role=CUSTOMER">
                <div className="group bg-card border border-border/50 rounded-xl p-5 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}>
                    <cat.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-sm">{cat.name}</p>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Post job</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Feature Highlight ───────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 via-violet-600 to-blue-700 rounded-3xl p-12 lg:p-16 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-300/10 rounded-full blur-3xl" />

            <div className="relative grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <Badge className="bg-white/20 text-white border-0 px-3 py-1.5 text-xs font-semibold gap-1.5 backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  Built-in AI Intelligence
                </Badge>
                <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
                  AI That Works<br />For You
                </h2>
                <p className="text-blue-100 leading-relaxed max-w-md">
                  ServiceConnect's AI enhances every step — from writing better job descriptions
                  to matching you with the perfect professional.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Sparkles, title: "Smart Descriptions", desc: "AI rewrites your job brief for better responses" },
                  { icon: Shield, title: "Fraud Detection", desc: "Deep AI analysis blocks scams automatically" },
                  { icon: Zap, title: "Instant Matching", desc: "AI ranks pros by relevance to your job" },
                  { icon: Star, title: "Quote Advisor", desc: "AI suggests fair prices based on market data" },
                ].map((feat) => (
                  <div key={feat.title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
                    <feat.icon className="w-6 h-6 mb-3 text-amber-300" />
                    <p className="font-bold text-sm mb-1">{feat.title}</p>
                    <p className="text-xs text-blue-100 leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <section id="testimonials" className="py-24 px-6 bg-gradient-to-b from-background to-blue-50/30 dark:to-gray-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-0 px-3 py-1 text-xs font-semibold mb-4">Real Experiences</Badge>
            <h2 className="text-4xl font-extrabold tracking-tight">What Customers & Pros Say</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Every review is tied to a real booking between a customer and their professional.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-card border border-border/50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Spin Wheel Teaser ─────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 border border-amber-200 dark:border-amber-800 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30 flex-shrink-0">
              <Dices className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-0 mb-3 text-xs font-semibold">For Professionals</Badge>
              <h3 className="text-2xl font-extrabold tracking-tight mb-2">Daily Spin — Win Free Credits</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Every 72 hours, verified pros get to spin the wheel for a chance to win free credits, profile boosts, and exclusive badges. No catch.
              </p>
            </div>
            <Link href="/register?role=PROFESSIONAL">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 gap-2 flex-shrink-0">
                <Dices className="w-4 h-4" /> Join to Spin
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-extrabold tracking-tight">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Post your first job in under 2 minutes — completely free. Our AI will help you craft the perfect brief.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register?role=CUSTOMER">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-xl shadow-blue-500/25 h-13 px-10 text-base font-semibold gap-2 group">
                Post a Job Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/register?role=PROFESSIONAL">
              <Button size="lg" variant="outline" className="h-13 px-10 text-base font-semibold border-2">
                Join as a Professional
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-border/50 bg-card/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-sm">ServiceConnect</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 ServiceConnect. All rights reserved. Built in Ireland 🇮🇪</p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
