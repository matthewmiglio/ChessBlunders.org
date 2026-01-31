import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - ChessBlunders",
  description:
    "Learn how ChessBlunders collects, uses, and protects your personal information.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy - ChessBlunders",
    description:
      "Learn how ChessBlunders collects, uses, and protects your personal information.",
    url: "https://chessblunders.org/privacy",
    siteName: "ChessBlunders.org",
    type: "website",
    locale: "en_US",
  },
};

export default function PrivacyPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#141414] sm:bg-gradient-to-b sm:from-[#141414] sm:via-[#1a1a1a] sm:to-[#141414]" />
      </div>

      <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4">
        {/* Header */}
        <div className="space-y-4 mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#f5f5f5]">
            Privacy Policy
          </h1>
          <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
          <p className="text-[#b4b4b4]">Last updated: January 2025</p>
        </div>

        {/* Content */}
        <div className="space-y-10">
          <Section title="Overview">
            <p>
              ChessBlunders.org ("we", "our", or "us") is committed to protecting
              your privacy. This policy explains how we collect, use, and safeguard
              your information when you use our chess training platform.
            </p>
          </Section>

          <Section title="Information We Collect">
            <p className="mb-4">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>
                <span className="text-[#f5f5f5]">Account Information:</span> Email
                address and encrypted password when you create an account
              </li>
              <li>
                <span className="text-[#f5f5f5]">Chess Data:</span> Games you import
                from Chess.com, analysis results, and practice statistics
              </li>
              <li>
                <span className="text-[#f5f5f5]">Payment Information:</span> Processed
                securely by Stripe. We do not store your credit card details
              </li>
              <li>
                <span className="text-[#f5f5f5]">Feedback:</span> Any feedback or
                messages you submit through our contact form
              </li>
            </ul>
          </Section>

          <Section title="How We Use Your Information">
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>To provide and maintain our chess training service</li>
              <li>To analyze your games and generate personalized puzzles</li>
              <li>To track your progress and practice statistics</li>
              <li>To process subscription payments</li>
              <li>To respond to your feedback and support requests</li>
              <li>To send important service-related communications</li>
            </ul>
          </Section>

          <Section title="Data Storage and Security">
            <p className="mb-4">
              Your data is stored securely using Supabase, a trusted cloud database
              provider. We implement appropriate security measures including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>Encrypted password storage (passwords are never stored in plain text)</li>
              <li>Secure HTTPS connections for all data transmission</li>
              <li>Payment processing handled entirely by Stripe (PCI compliant)</li>
            </ul>
          </Section>

          <Section title="Third-Party Services">
            <p className="mb-4">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>
                <span className="text-[#f5f5f5]">Supabase:</span> For authentication
                and data storage
              </li>
              <li>
                <span className="text-[#f5f5f5]">Stripe:</span> For secure payment
                processing
              </li>
              <li>
                <span className="text-[#f5f5f5]">Chess.com API:</span> To import your
                games (with your permission)
              </li>
            </ul>
          </Section>

          <Section title="Your Rights">
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Cancel your subscription at any time</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us through our feedback page.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use essential cookies for authentication and session management.
              These cookies are necessary for the service to function and cannot be
              disabled.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              We may update this privacy policy from time to time. We will notify you
              of any significant changes by posting the new policy on this page and
              updating the "Last updated" date.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              If you have questions about this privacy policy or our data practices,
              please contact us through our{" "}
              <a
                href="/feedback"
                className="text-[#f44336] hover:text-[#ff6f00] transition-colors"
              >
                feedback page
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold text-[#f5f5f5]">{title}</h2>
      <div className="text-[#b4b4b4] leading-relaxed">{children}</div>
    </section>
  );
}
