import type { Metadata } from "next";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service | Lost City",
  description: "Terms of Service for Lost City - the rules and guidelines for using our platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <UnifiedHeader />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-[var(--cream)] mb-2">Terms of Service</h1>
        <p className="text-[var(--muted)] text-sm mb-8">Last updated: January 21, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[var(--soft)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">1. Agreement to Terms</h2>
            <p>
              Welcome to Lost City. These Terms of Service (&quot;Terms&quot;) govern your access to and use
              of the Lost City website, applications, and services (collectively, the &quot;Service&quot;).
              By accessing or using the Service, you agree to be bound by these Terms.
            </p>
            <p className="mt-3">
              If you do not agree to these Terms, you may not access or use the Service. We may modify
              these Terms at any time, and your continued use of the Service constitutes acceptance
              of any modifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">2. Description of Service</h2>
            <p>
              Lost City is an event discovery platform that aggregates and displays information about
              local events, venues, and activities. We use automated systems and artificial intelligence
              to collect, organize, and present event information from various public sources.
            </p>
            <p className="mt-3">
              The Service allows users to browse events, create accounts, save events, RSVP to events,
              follow other users, and share recommendations. We do not sell tickets or facilitate
              transactions for events listed on our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">3. User Accounts</h2>
            <p>
              To access certain features of the Service, you must create an account. When creating
              an account, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update any information that becomes inaccurate</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
              <li>Notify us immediately of any unauthorized access or security breach</li>
            </ul>
            <p className="mt-3">
              You must be at least 13 years old to create an account. We reserve the right to
              suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Use the Service for any unlawful purpose or in violation of any laws</li>
              <li>Post or transmit harmful, threatening, abusive, or objectionable content</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorized access to the Service or other users&apos; accounts</li>
              <li>Interfere with or disrupt the Service or servers connected to it</li>
              <li>Use automated means to access the Service without our permission</li>
              <li>Collect or harvest user information without consent</li>
              <li>Use the Service to send spam or unsolicited communications</li>
              <li>Violate the intellectual property rights of others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">5. Event Information</h2>
            <p>
              Event information displayed on Lost City is collected from third-party sources and
              may be generated or processed using artificial intelligence. While we strive for
              accuracy, we do not guarantee that event information is complete, accurate, or
              up-to-date.
            </p>
            <p className="mt-3">
              <strong>Important:</strong> Always verify event details (date, time, location, pricing,
              availability) directly with the event organizer or venue before attending. Lost City
              is not responsible for cancelled, rescheduled, or modified events.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">6. User Content</h2>
            <p>
              You may have the opportunity to submit content to the Service, including profile
              information, recommendations, and other materials (&quot;User Content&quot;). You retain
              ownership of your User Content, but by submitting it, you grant us a worldwide,
              non-exclusive, royalty-free license to use, display, and distribute your User
              Content in connection with the Service.
            </p>
            <p className="mt-3">
              You represent and warrant that you have all necessary rights to submit your User
              Content and that it does not violate any third-party rights or these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">7. Intellectual Property</h2>
            <p>
              The Service, including its design, features, and content (excluding User Content and
              third-party event information), is owned by Lost City and protected by copyright,
              trademark, and other intellectual property laws.
            </p>
            <p className="mt-3">
              You may not copy, modify, distribute, sell, or lease any part of the Service without
              our written permission. The Lost City name, logo, and related marks are our trademarks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">8. Third-Party Links and Services</h2>
            <p>
              The Service may contain links to third-party websites, including event ticketing
              platforms, venue websites, and social media. We are not responsible for the content,
              policies, or practices of these third-party sites.
            </p>
            <p className="mt-3">
              Any transactions you conduct with third parties (such as ticket purchases) are solely
              between you and that third party. We are not a party to such transactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">9. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-3">
              We do not warrant that the Service will be uninterrupted, secure, or error-free,
              that defects will be corrected, or that the Service is free of viruses or other
              harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOST CITY AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL,
              ARISING FROM YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-3">
              IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID US, IF ANY, IN
              THE PAST TWELVE MONTHS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Lost City and its officers,
              directors, employees, and agents from any claims, damages, losses, liabilities,
              and expenses (including attorneys&apos; fees) arising from your use of the Service,
              your User Content, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">12. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time, with or without
              cause, and with or without notice. You may terminate your account at any time by
              contacting us. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Georgia, United States, without regard to its conflict of law provisions.
              Any disputes arising from these Terms or the Service shall be resolved in the courts
              of Fulton County, Georgia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">14. Privacy</h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="text-[var(--coral)] hover:underline">
                Privacy Policy
              </Link>
              , which describes how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">15. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. If we make material changes,
              we will notify you by updating the &quot;Last updated&quot; date and, where appropriate,
              providing additional notice. Your continued use of the Service after changes take
              effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">16. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="mt-3">
              <strong>Email:</strong>{" "}
              <a href="mailto:coach@lostcity.ai" className="text-[var(--coral)] hover:underline">
                coach@lostcity.ai
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-3">17. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that
              provision shall be limited or eliminated to the minimum extent necessary, and
              the remaining provisions shall remain in full force and effect.
            </p>
          </section>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
