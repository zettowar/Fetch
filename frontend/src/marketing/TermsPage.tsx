import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

const LAST_UPDATED = 'July 4, 2026';

export default function TermsPage() {
  useDocumentTitle('Terms · Fetch');

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow="Terms of service"
        title="The house rules"
        subtitle={`The deal between you and Fetch, in plain English. Last updated ${LAST_UPDATED}.`}
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-10 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
        <section>
          <p>
            By creating an account or using Fetch, you agree to these terms.
            Fetch is currently an invite-only beta, so expect things to change
            while we build. Questions go to{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              fetchpawz.inc@gmail.com
            </a>
            .
          </p>
        </section>

        <LegalSection title="Your account">
          <p>
            You need to be at least 13 to use Fetch, and if you're under 18,
            a parent or guardian should be on board. Keep your login to
            yourself, give us accurate information, and use one account per
            person. You're responsible for what happens on your account.
          </p>
        </LegalSection>

        <LegalSection title="Your content">
          <p>
            Your photos and words stay yours. By posting them you give us
            permission to host, resize, and display them so the app works
            (that's what a feed is). Only post dogs you own, or, for rescue
            accounts, dogs your organization is authorized to list. Delete
            your content or account whenever you like.
          </p>
        </LegalSection>

        <LegalSection title="Behavior">
          <p>
            Be the person your dog thinks you are. Specifically, don't:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>harass other users or post content that's hateful, explicit, or illegal;</li>
            <li>file false lost-dog reports or fake sightings;</li>
            <li>pose as a rescue you don't represent;</li>
            <li>scrape the service or use it to spam people.</li>
          </ul>
          <p className="mt-3">
            We review reported content, and repeat violations lead to
            suspension. Photos are also screened automatically before they
            appear publicly.
          </p>
        </LegalSection>

        <LegalSection title="Rescue accounts">
          <p>
            Rescue accounts are reviewed and approved by hand before listing
            dogs. Keep listings accurate, mark dogs adopted promptly, and
            treat adopter inquiries with care. We can revoke approval if a
            rescue account is misused.
          </p>
        </LegalSection>

        <LegalSection title="Lost & Found">
          <p>
            Lost & Found runs on community reports. We can't guarantee a
            sighting is accurate or that a lost dog will be found, and Fetch
            shouldn't be your only channel when a dog is missing. Use normal
            caution when arranging to meet anyone about a dog.
          </p>
        </LegalSection>

        <LegalSection title="Shop and donations">
          <p>
            The shop is powered by Shopify, and purchases (including payment,
            shipping, and returns) run through Shopify checkout. Donation
            links on rescue profiles go straight to the rescue's own donation
            page; Fetch is not a party to those donations.
          </p>
        </LegalSection>

        <LegalSection title="Not veterinary advice">
          <p>
            Nothing on Fetch, including vet listings and community posts, is
            veterinary or medical advice. In an emergency, call a real vet.
          </p>
        </LegalSection>

        <LegalSection title="Beta, availability, and liability">
          <p>
            Fetch is provided as-is while in beta. Features may change, break,
            or be removed, and we may pause or revoke beta access as we test.
            To the fullest extent the law allows, we're not liable for
            indirect or consequential damages arising from your use of the
            service. Nothing in these terms limits liability that can't be
            limited by law.
          </p>
        </LegalSection>

        <LegalSection title="Ending things">
          <p>
            You can delete your account at any time from inside the app. We
            can suspend or terminate accounts that break these rules. If a
            suspension is a mistake, email us and a person will look at it.
          </p>
        </LegalSection>

        <LegalSection title="Changes to these terms">
          <p>
            When we change these terms, we'll update the date at the top and
            email account holders about anything significant. Using Fetch
            after a change means you accept the new terms.
          </p>
        </LegalSection>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center shadow-soft-sm">
          <p className="text-sm">
            See also the{' '}
            <Link to="/privacy" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              Privacy Policy
            </Link>
            , or write to{' '}
            <a href="mailto:fetchpawz.inc@gmail.com" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
              fetchpawz.inc@gmail.com
            </a>
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
