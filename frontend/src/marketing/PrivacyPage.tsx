import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

const LAST_UPDATED = 'July 4, 2026';

export default function PrivacyPage() {
  useDocumentTitle('Privacy · Fetchpawz');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="Privacy policy"
        title="Your data, plainly"
        subtitle={`What we collect, why we collect it, and what we will never do with it. Last updated ${LAST_UPDATED}.`}
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-10 text-base leading-relaxed text-gray-600 dark:text-gray-400">
        <section>
          <p>
            Fetchpawz is a place to show off your pet, not a data business.
            Fetchpawz, the app and this website, is operated by Fetchpawz Inc. This
            page explains what information they handle.
            We've tried to write it the way we'd want to read it. If anything
            is unclear, email us at{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              fetchpawz.inc@gmail.com
            </a>{' '}
            and a person will answer.
          </p>
        </section>

        <LegalSection title="What we collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Your account.</strong>{' '}
              Email address and display name. Your password is stored only as
              a cryptographic hash; we cannot read it.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Your pets.</strong>{' '}
              Photos, names, breeds, birthdays, bios, and traits you add.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Your activity.</strong>{' '}
              Votes, follows, comments, reactions, park check-ins, and
              anything else you do in the app.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Location you give us.</strong>{' '}
              Lost & Found reports, park check-ins, and alert subscriptions
              use coordinates you provide. Lost-report locations shown to
              other users are deliberately blurred to a radius you control,
              so strangers never see the exact spot.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Approximate location from your IP.</strong>{' '}
              Used once to center maps near you before you grant precise
              location. You can turn this off, and we never store it.
            </li>
            <li>
              <strong className="text-gray-900 dark:text-gray-100">Technical logs.</strong>{' '}
              Standard request logs and error reports that help us keep the
              service running.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="What we use it for">
          <p>
            Running Fetchpawz: showing pets in the feed, counting votes, sending
            the emails you'd expect (password resets, email verification,
            lost-pet alerts you subscribed to, messages relayed from other
            users about your lost-pet report), and keeping the community safe
            through content moderation.
          </p>
        </LegalSection>

        <LegalSection title="Who touches your data">
          <p>A few services process data on our behalf:</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li><strong className="text-gray-900 dark:text-gray-100">Resend</strong> delivers our email.</li>
            <li><strong className="text-gray-900 dark:text-gray-100">Sightengine</strong> scans uploaded photos for content that breaks our rules.</li>
            <li><strong className="text-gray-900 dark:text-gray-100">Sentry</strong> receives error reports so we can fix crashes.</li>
            <li><strong className="text-gray-900 dark:text-gray-100">Shopify</strong> runs the shop, including checkout and payment. Purchases are covered by Shopify's own privacy terms.</li>
          </ul>
          <p className="mt-3">
            Beyond that, we share data only if the law requires it. Donation
            links on rescue profiles point to the rescue's own donation page;
            we're not part of that transaction and see nothing about it.
          </p>
        </LegalSection>

        <LegalSection title="What we will never do">
          <p>
            We don't sell your data. We don't run ad targeting. We don't show
            your email address to other users, including when Fetchpawz relays a
            message about your lost-pet report.
          </p>
        </LegalSection>

        <LegalSection title="Deleting your data">
          <p>
            You can delete your account from inside the app, which deactivates
            your profile and your pets immediately. Uploaded photos you remove
            are deleted from storage. Copies in our database backups age out
            on a rolling basis, currently within 14 days.
          </p>
        </LegalSection>

        <LegalSection title="Cookies and local storage">
          <p>
            No advertising cookies. Your browser's local storage holds your
            theme preference, your login session, and (if you use the demo
            shop) your cart. That's it.
          </p>
        </LegalSection>

        <LegalSection title="Children">
          <p>
            Fetchpawz is not directed at children under 13, and we don't knowingly
            collect their data. If you believe a child is using Fetchpawz, tell us
            and we'll remove the account.
          </p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>
            Fetchpawz is in beta and this policy will evolve with it. We'll update
            the date at the top when it does, and email you about anything
            that meaningfully changes how your data is handled.
          </p>
        </LegalSection>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center shadow-soft-sm">
          <p className="text-sm">
            Questions about your data? Email{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              fetchpawz.inc@gmail.com
            </a>{' '}
            or read the{' '}
            <Link to="/terms" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
