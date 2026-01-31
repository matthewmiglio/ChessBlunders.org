import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - ChessBlunders",
  description:
    "Terms and conditions for using the ChessBlunders chess training platform.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service - ChessBlunders",
    description:
      "Terms and conditions for using the ChessBlunders chess training platform.",
    url: "https://chessblunders.org/terms",
    siteName: "ChessBlunders.org",
    type: "website",
    locale: "en_US",
  },
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
          <p className="text-[#b4b4b4]">Last updated: January 2025</p>
        </div>

        {/* Content */}
        <div className="space-y-10">
          <Section title="Agreement to Terms">
            <p>
              By accessing or using ChessBlunders.org ("the Service"), you agree to
              be bound by these Terms of Service. If you do not agree to these terms,
              please do not use the Service.
            </p>
          </Section>

          <Section title="Description of Service">
            <p>
              ChessBlunders is a chess training platform that analyzes your chess
              games, identifies blunders and mistakes, and converts them into puzzles
              for practice. The Service includes both free and paid subscription
              features.
            </p>
          </Section>

          <Section title="User Accounts">
            <p className="mb-4">When creating an account, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your password</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
            <p className="mt-4">
              We reserve the right to suspend or terminate accounts that violate
              these terms.
            </p>
          </Section>

          <Section title="Subscriptions and Payments">
            <p className="mb-4">For paid subscriptions:</p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>
                <span className="text-[#f5f5f5]">Billing:</span> Subscriptions are
                billed in advance on a monthly or yearly basis
              </li>
              <li>
                <span className="text-[#f5f5f5]">Automatic Renewal:</span> Subscriptions
                automatically renew unless cancelled before the renewal date
              </li>
              <li>
                <span className="text-[#f5f5f5]">Cancellation:</span> You may cancel
                your subscription at any time from your account page. You will retain
                access until the end of your current billing period
              </li>
              <li>
                <span className="text-[#f5f5f5]">Refunds:</span> We generally do not
                provide refunds for partial subscription periods. Contact us for
                exceptional circumstances
              </li>
              <li>
                <span className="text-[#f5f5f5]">Price Changes:</span> We may change
                subscription prices with 30 days notice. Price changes will apply to
                subsequent billing periods
              </li>
            </ul>
          </Section>

          <Section title="Acceptable Use">
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 text-[#b4b4b4]">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Share your account credentials with others</li>
              <li>Use automated systems to access the Service excessively</li>
              <li>Reverse engineer or attempt to extract source code</li>
            </ul>
          </Section>

          <Section title="Intellectual Property">
            <p className="mb-4">
              <span className="text-[#f5f5f5]">Our Content:</span> The Service,
              including its design, features, and content, is owned by ChessBlunders
              and protected by intellectual property laws.
            </p>
            <p>
              <span className="text-[#f5f5f5]">Your Content:</span> You retain
              ownership of the chess games you import. By using the Service, you
              grant us a license to process and analyze your games to provide the
              Service.
            </p>
          </Section>

          <Section title="Third-Party Services">
            <p>
              The Service integrates with third-party services including Chess.com
              for game imports and Stripe for payment processing. Your use of these
              integrations is also subject to their respective terms of service.
            </p>
          </Section>

          <Section title="Disclaimer of Warranties">
            <p>
              The Service is provided "as is" without warranties of any kind. We do
              not guarantee that the Service will be uninterrupted, error-free, or
              that analysis results will be perfectly accurate. Chess analysis is
              provided for training purposes only.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              To the maximum extent permitted by law, ChessBlunders shall not be
              liable for any indirect, incidental, special, or consequential damages
              arising from your use of the Service. Our total liability shall not
              exceed the amount you paid for the Service in the 12 months preceding
              the claim.
            </p>
          </Section>

          <Section title="Changes to Terms">
            <p>
              We may update these terms from time to time. We will notify users of
              significant changes via email or through the Service. Continued use
              after changes constitutes acceptance of the new terms.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              We may terminate or suspend your access to the Service at our
              discretion, with or without notice, for conduct that we believe
              violates these terms or is harmful to other users or the Service.
            </p>
          </Section>

          <Section title="Governing Law">
            <p>
              These terms shall be governed by and construed in accordance with
              applicable laws, without regard to conflict of law principles.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For questions about these terms, please contact us through our{" "}
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
