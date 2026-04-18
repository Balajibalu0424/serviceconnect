import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

function LegalShell({ title, updated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-card/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600" />
            ServiceConnect
          </Link>
          <Link href="/">
            <Button size="sm" variant="ghost" className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Button>
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: {updated}</p>
        <div className="prose prose-sm md:prose-base dark:prose-invert mt-8 max-w-none">
          {children}
        </div>
        <footer className="mt-16 pt-6 border-t border-border/50 text-xs text-muted-foreground flex flex-wrap gap-4">
          <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/legal/cookies" className="hover:text-foreground">Cookies</Link>
          <span>© 2026 ServiceConnect</span>
        </footer>
      </main>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy" updated="17 April 2026">
      <p>
        ServiceConnect ("we", "us", "the platform") is an Irish service marketplace that connects
        customers with verified professionals. This policy explains what personal information we
        collect, how we use it, how we protect it, and what rights you have under the General Data
        Protection Regulation (GDPR) and the Irish Data Protection Act 2018.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, phone number, hashed password, role.</li>
        <li><strong>Profile data:</strong> professional business details, service categories, areas served, portfolio uploads, verification documents.</li>
        <li><strong>Job data:</strong> descriptions, locations, photos, quotes, bookings and review content.</li>
        <li><strong>Transaction data:</strong> credit purchases, payment status, Stripe payment identifiers (no card numbers are stored by us — Stripe handles those directly).</li>
        <li><strong>Technical data:</strong> IP address, device information, timestamps used to prevent abuse and investigate incidents.</li>
      </ul>

      <h2>2. How we use data</h2>
      <ul>
        <li>To operate the marketplace (matching, messaging, booking, aftercare).</li>
        <li>To process payments through Stripe and maintain an accurate credit ledger.</li>
        <li>To verify identities and protect against fraud, spam and abuse.</li>
        <li>To send service-related notifications (you may disable non-critical ones in Settings).</li>
        <li>To comply with legal obligations and respond to lawful requests.</li>
      </ul>

      <h2>3. Legal bases (GDPR Article 6)</h2>
      <p>We process personal data under one or more of: contractual necessity (to deliver the service you signed up for), legitimate interests (fraud prevention, platform safety), legal obligation, and your consent where required (e.g. optional marketing).</p>

      <h2>4. Sharing</h2>
      <p>We share only what is strictly necessary:</p>
      <ul>
        <li>Between matched customers and professionals for the purpose of completing a job.</li>
        <li>With processors who help us run the service: Supabase / PostgreSQL hosting, Vercel, Stripe (payments), Resend (email), Twilio (SMS OTP), Pusher (realtime), Vercel Blob (file uploads), Google Gemini (AI assistance).</li>
        <li>With law-enforcement or regulators when legally compelled.</li>
      </ul>
      <p>We do not sell personal data.</p>

      <h2>5. International transfers</h2>
      <p>Some processors are based outside the EEA. Where this is the case, transfers are covered by the European Commission's Standard Contractual Clauses or equivalent safeguards.</p>

      <h2>6. Retention</h2>
      <p>We keep account data for as long as the account is active, plus a limited period after closure to meet legal and accounting obligations. Payment records are kept for the period required by Irish tax law.</p>

      <h2>7. Your rights</h2>
      <p>You have the right to access, rectify, erase, restrict, port and object to processing of your personal data. You can exercise these rights from your account Settings or by emailing <a href="mailto:privacy@serviceconnect.ie">privacy@serviceconnect.ie</a>. You also have the right to complain to the Irish Data Protection Commission at <a href="https://www.dataprotection.ie" target="_blank" rel="noreferrer">dataprotection.ie</a>.</p>

      <h2>8. Security</h2>
      <p>Passwords are hashed with bcrypt. Sessions use short-lived access tokens and rotating refresh tokens. Payment card data never touches our servers; Stripe Elements tokenises it in the browser.</p>

      <h2>9. Children</h2>
      <p>ServiceConnect is not intended for anyone under 18. We will delete accounts we discover belong to minors.</p>

      <h2>10. Changes</h2>
      <p>If we materially change this policy we will notify active users in-app or by email. Continued use of the platform after a change means you accept the updated policy.</p>

      <h2>11. Contact</h2>
      <p>Data Controller: ServiceConnect, Dublin, Ireland. Email: <a href="mailto:privacy@serviceconnect.ie">privacy@serviceconnect.ie</a>.</p>
    </LegalShell>
  );
}

export function TermsOfService() {
  return (
    <LegalShell title="Terms of Service" updated="17 April 2026">
      <p>
        These Terms govern your use of ServiceConnect. By creating an account or using the platform
        you agree to these Terms. If you do not agree, please do not use the service.
      </p>

      <h2>1. The service</h2>
      <p>ServiceConnect is a marketplace. We connect customers with professionals but we are not a party to the underlying service contract between them. Professionals are independent contractors, not employees or agents of ServiceConnect.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old and able to enter into a binding contract under Irish law. Professionals must hold any licenses, certifications or insurance required for the work they perform.</p>

      <h2>3. Accounts</h2>
      <p>You are responsible for everything that happens under your account. Keep your credentials secure and notify us immediately of any unauthorised access. We may suspend or close accounts that breach these Terms or that create risk for other users.</p>

      <h2>4. Credits and payments</h2>
      <ul>
        <li>Credits are the in-platform unit professionals spend to unlock leads and access contact details.</li>
        <li>Credits never expire while your account is active.</li>
        <li>Payments are processed by Stripe. ServiceConnect never stores card numbers.</li>
        <li>Refunds follow the first-pack money-back guarantee described in product materials; discretionary refunds may be granted by support.</li>
        <li>When a payment is refunded, any credits granted by that payment are reversed. If some of those credits have already been spent, the reversal drives your balance negative until repaid.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>No fraudulent, harassing, discriminatory, threatening or illegal content or behaviour.</li>
        <li>No scraping, reverse engineering or automated abuse of the platform.</li>
        <li>No attempts to circumvent the credit or matching system, including solicitation of off-platform payment to avoid credit costs on first-contact leads.</li>
        <li>Content you post (job descriptions, quotes, reviews, messages) must be accurate and lawful.</li>
      </ul>

      <h2>6. Content and reviews</h2>
      <p>You retain rights in content you post but grant ServiceConnect a non-exclusive, royalty-free licence to host, display and distribute it as needed to operate the platform. Reviews must be based on genuine experience. False or retaliatory reviews may be removed.</p>

      <h2>7. Professional verification</h2>
      <p>Professionals are invited to upload verification documents. "Verified" status indicates we reviewed a submitted document; it is not a guarantee of workmanship. Customers remain responsible for assessing any professional they hire.</p>

      <h2>8. Disputes</h2>
      <p>Disputes between a customer and a professional should first be raised with the other party and, if unresolved, escalated to ServiceConnect support. We may mediate but are not a party to the underlying agreement.</p>

      <h2>9. Suspension and termination</h2>
      <p>We may suspend or remove accounts that breach these Terms, create safety risk, or are inactive for prolonged periods. You may close your account at any time from Settings.</p>

      <h2>10. Liability</h2>
      <p>To the fullest extent permitted by law, ServiceConnect is not liable for the conduct of users, the quality of services delivered off-platform, or indirect or consequential losses. Nothing in these Terms limits liability for death, personal injury caused by negligence, fraud, or any other liability that cannot be excluded under Irish law.</p>

      <h2>11. Governing law</h2>
      <p>These Terms are governed by the laws of Ireland. Disputes are subject to the non-exclusive jurisdiction of the Irish courts.</p>

      <h2>12. Contact</h2>
      <p>Email <a href="mailto:support@serviceconnect.ie">support@serviceconnect.ie</a> for any question about these Terms.</p>
    </LegalShell>
  );
}

export function CookiesPolicy() {
  return (
    <LegalShell title="Cookies Policy" updated="17 April 2026">
      <p>
        ServiceConnect uses a minimal set of cookies and similar technologies to run the platform
        securely. We do not use advertising cookies or third-party tracking for marketing.
      </p>

      <h2>1. What we use</h2>
      <ul>
        <li><strong>Essential</strong> — session token storage, CSRF protection, authenticated state. These are required for the service to work and cannot be disabled.</li>
        <li><strong>Functional</strong> — remembering your preferences (for example theme, notification settings).</li>
        <li><strong>Payments</strong> — Stripe sets cookies on its checkout frames to prevent fraud. These are managed directly by Stripe under its own policy.</li>
        <li><strong>Realtime</strong> — Pusher may set short-lived cookies for its websocket authentication.</li>
      </ul>

      <h2>2. What we do not use</h2>
      <ul>
        <li>Advertising or remarketing cookies.</li>
        <li>Cross-site tracking pixels.</li>
        <li>Sold or shared identifiers for third-party marketing.</li>
      </ul>

      <h2>3. Managing cookies</h2>
      <p>Most browsers let you block or delete cookies in their settings. Blocking essential cookies will break sign-in and payment flows. Third-party cookies set by Stripe or Pusher can be reviewed on their respective websites.</p>

      <h2>4. Changes</h2>
      <p>If our use of cookies meaningfully changes we will update this page and notify active users.</p>

      <h2>5. Contact</h2>
      <p>Email <a href="mailto:privacy@serviceconnect.ie">privacy@serviceconnect.ie</a> for cookie-related questions.</p>
    </LegalShell>
  );
}
