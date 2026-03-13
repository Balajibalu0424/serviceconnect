import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator, ArrowRight, Shield, Star, Users, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ICON_MAP: Record<string, any> = {
  Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator
};

export default function Home() {
  const { user } = useAuth();
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const dashboardLink = user?.role === "PROFESSIONAL" ? "/pro/dashboard"
    : user?.role === "ADMIN" ? "/admin"
    : user ? "/dashboard" : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card sticky top-0 z-40">
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
                <Link href="/post-job"><Button size="sm">Post a Job</Button></Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/5 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Ireland's #1 Service Marketplace</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
            Find trusted local professionals — <span className="text-primary">instantly</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Post your job for free. Get quotes from vetted local professionals. No hassle, no hidden fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/post-job">
              <Button size="lg" className="gap-2 text-base px-8">
                Post a Job Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                Join as a Professional
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-accent" /> Free to post jobs</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-accent" /> Verified professionals</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-accent" /> Dublin & beyond</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "10,000+", label: "Jobs completed" },
            { value: "2,500+", label: "Verified pros" },
            { value: "4.8★", label: "Average rating" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Browse by category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {categories.map((cat: any) => {
              const Icon = ICON_MAP[cat.icon] || Wrench;
              return (
                <Link key={cat.id} href={`/post-job?category=${cat.id}`}>
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
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

      {/* How it works */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> For Customers</h3>
              {[
                { step: "1", title: "Post your job", desc: "Describe what you need and post it — completely free" },
                { step: "2", title: "Receive quotes", desc: "Get competitive quotes from vetted local professionals" },
                { step: "3", title: "Choose & book", desc: "Pick the best professional and get your job done" },
              ].map(s => (
                <div key={s.step} className="flex gap-4 mb-6">
                  <div className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{s.step}</div>
                  <div><div className="font-medium">{s.title}</div><div className="text-sm text-muted-foreground">{s.desc}</div></div>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2"><Shield className="w-5 h-5 text-accent" /> For Professionals</h3>
              {[
                { step: "1", title: "Browse live jobs", desc: "See jobs posted in your area and service categories" },
                { step: "2", title: "Unlock leads", desc: "Use credits to unlock job details and connect with customers" },
                { step: "3", title: "Win more work", desc: "Quote, book, and grow your business on ServiceConnect" },
              ].map(s => (
                <div key={s.step} className="flex gap-4 mb-6">
                  <div className="w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{s.step}</div>
                  <div><div className="font-medium">{s.title}</div><div className="text-sm text-muted-foreground">{s.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm text-muted-foreground">ServiceConnect © 2024</span>
          </div>
          <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">Created with Perplexity Computer</a>
        </div>
      </footer>
    </div>
  );
}
