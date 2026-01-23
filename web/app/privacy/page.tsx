import type { Metadata } from "next";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | Lost City",
  description: "Privacy Policy for Lost City - how we collect, use, and protect your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <UnifiedHeader />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-[var(--cream)] mb-2">Privacy Policy</h1>
        <p className="text-[var(--muted)] text-sm mb-8">Last updated: January 21, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[var(--soft)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">1. Introduction</h2>
            <p>
              Lost City (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Lost City platform,
              an event discovery service. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our website and services.
            </p>
            <p className="mt-3">
              By using Lost City, you agree to the collection and use of information in accordance
              with this policy. If you do not agree with our policies, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-[var(--cream)] mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> When you create an account, we collect your email address, username, and display name.</li>
              <li><strong>Profile Information:</strong> You may optionally provide a profile photo, bio, location, and website.</li>
              <li><strong>Preferences:</strong> Your event preferences, favorite categories, neighborhoods, and interests.</li>
              <li><strong>Social Interactions:</strong> Information about events you save, RSVP to, recommend, or share with friends.</li>
              <li><strong>Communications:</strong> When you contact us, we collect the content of your messages.</li>
            </ul>

            <h3 className="text-lg font-medium text-[var(--cream)] mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> Pages visited, features used, search queries, and interactions with events.</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device type, and screen resolution.</li>
              <li><strong>Location Data:</strong> Approximate location based on IP address or, with your permission, more precise location data.</li>
              <li><strong>Cookies:</strong> We use cookies and similar technologies for authentication, preferences, and analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Provide, maintain, and improve our services</li>
              <li>Personalize your experience and recommend relevant events</li>
              <li>Process your account registration and manage your profile</li>
              <li>Enable social features like following friends and sharing events</li>
              <li>Send notifications about events you&apos;re interested in</li>
              <li>Communicate with you about updates, features, and support</li>
              <li>Analyze usage patterns to improve our platform</li>
              <li>Detect and prevent fraud, abuse, and security issues</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">4. Information Sharing</h2>
            <p>We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Public Profile:</strong> Your username, display name, and profile photo are visible to other users.</li>
              <li><strong>Social Features:</strong> Your RSVPs and recommendations may be visible to friends who follow you.</li>
              <li><strong>Service Providers:</strong> We work with third-party services for hosting, analytics, and email delivery.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction. However,
              no method of transmission over the Internet is 100% secure, and we cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">6. Your Rights and Choices</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information through your account settings.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications at any time.</li>
              <li><strong>Data Portability:</strong> Request your data in a portable format.</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:coach@lostcity.ai" className="text-[var(--coral)] hover:underline">
                coach@lostcity.ai
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">7. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to authenticate users, remember preferences,
              and analyze how our service is used. You can control cookies through your browser
              settings, but disabling them may affect functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">8. Third-Party Links</h2>
            <p>
              Our service may contain links to third-party websites, including event ticketing
              platforms and venue websites. We are not responsible for the privacy practices of
              these external sites. We encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Lost City is not intended for children under 13 years of age. We do not knowingly
              collect personal information from children under 13. If you believe we have collected
              information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new policy on this page and updating the
              &quot;Last updated&quot; date. Your continued use of the service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our privacy practices, please
              contact us at:
            </p>
            <p className="mt-3">
              <strong>Email:</strong>{" "}
              <a href="mailto:coach@lostcity.ai" className="text-[var(--coral)] hover:underline">
                coach@lostcity.ai
              </a>
            </p>
          </section>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
