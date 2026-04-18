import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Briefcase, Wrench } from "lucide-react";
import {
  CUSTOMER_ONBOARDING_PATH,
  PROFESSIONAL_ONBOARDING_PATH,
} from "@/lib/publicRoutes";

/**
 * Shared nav + footer used by public marketing pages so they share a coherent
 * chrome with the homepage. Pages keep full control of their hero/body
 * sections; this just wraps them.
 */
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
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
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
            <Link href="/services" className="hover:text-foreground transition-colors">Services</Link>
            <Link href="/testimonials" className="hover:text-foreground transition-colors">Testimonials</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm font-medium">Sign In</Button>
            </Link>
            <Link href={PROFESSIONAL_ONBOARDING_PATH}>
              <Button variant="outline" size="sm" className="text-sm font-medium hidden sm:flex gap-1.5 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                <Wrench className="w-3.5 h-3.5" /> I'm a Pro
              </Button>
            </Link>
            <Link href={CUSTOMER_ONBOARDING_PATH}>
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 text-sm font-medium gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Post a Job
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">{children}</main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/50 bg-card/50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-bold text-sm">ServiceConnect</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ireland&apos;s service marketplace — built to make hiring local professionals simple, safe and fair.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</Link></li>
              <li><Link href="/services" className="text-muted-foreground hover:text-foreground transition-colors">Services</Link></li>
              <li><Link href="/testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Get started</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href={CUSTOMER_ONBOARDING_PATH} className="text-muted-foreground hover:text-foreground transition-colors">Post a job</Link></li>
              <li><Link href={PROFESSIONAL_ONBOARDING_PATH} className="text-muted-foreground hover:text-foreground transition-colors">Join as a pro</Link></li>
              <li><Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link></li>
              <li><Link href="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link></li>
              <li><Link href="/legal/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-border/40 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 ServiceConnect. All rights reserved.</p>
          <p>Built in Ireland 🇮🇪</p>
        </div>
      </footer>
    </div>
  );
}
