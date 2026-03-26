import { Link } from "wouter";
import { UserPlus, Briefcase, ArrowRight } from "lucide-react";

export default function Register() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="absolute top-0 w-full p-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-xl">ServiceConnect</span>
        </Link>
      </div>

      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6 relative z-10">
        <div className="text-center md:col-span-2 mb-6">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">Join ServiceConnect</h1>
          <p className="text-lg text-muted-foreground">Choose how you want to use the platform.</p>
        </div>

        {/* Customer Route */}
        <Link href="/register/customer">
          <div className="group relative bg-background border border-border hover:border-blue-500/50 rounded-2xl p-8 hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer h-full flex flex-col items-center text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="w-20 h-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <UserPlus className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl font-bold mb-3">Hire a Professional</h2>
            <p className="text-muted-foreground leading-relaxed flex-1 mb-8">
              Post a job for free and get matched with top local, verified professionals ready to help.
            </p>
            
            <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all mt-auto">
              Sign up as a Customer <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </Link>

        {/* Professional Route */}
        <Link href="/pro/onboarding">
          <div className="group relative bg-background border border-border hover:border-violet-500/50 rounded-2xl p-8 hover:shadow-xl hover:shadow-violet-500/10 transition-all cursor-pointer h-full flex flex-col items-center text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="w-20 h-20 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <Briefcase className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl font-bold mb-3">Join as a Professional</h2>
            <p className="text-muted-foreground leading-relaxed flex-1 mb-8">
              Find new clients, manage bookings, and grow your local service business with ease.
            </p>
            
            <div className="flex items-center gap-2 text-violet-600 font-semibold group-hover:gap-3 transition-all mt-auto">
              Sign up as a Pro <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </Link>

        <div className="md:col-span-2 text-center mt-8 text-muted-foreground">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline font-medium">Log in</Link>
        </div>
      </div>
    </div>
  );
}
