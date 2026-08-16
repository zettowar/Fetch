import { Link } from 'react-router-dom';
import LegalDoc, { LegalList, LegalTable, Term } from './LegalDoc';
import type { LegalSectionSpec } from './LegalDoc';

const LAST_UPDATED = 'August 16, 2026';
const CONTACT = 'fetchpawz.inc@gmail.com';

function Mail({ children }: { children?: React.ReactNode }) {
  return (
    <a
      href={`mailto:${CONTACT}`}
      className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
    >
      {children ?? CONTACT}
    </a>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
    >
      {children}
    </a>
  );
}

const SECTIONS: LegalSectionSpec[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          Fetchpawz Inc. ("Fetchpawz", "we", "us") is a company based in Alberta,
          Canada. We operate the Fetchpawz website and app. We are responsible
          for the personal information described here, including information we
          pass to the service providers listed below.
        </p>
        <p>
          Canada's <Term>Personal Information Protection and Electronic
          Documents Act (PIPEDA)</Term> requires us to name an individual
          accountable for privacy at Fetchpawz. That person is reachable at{' '}
          <Mail />. Because we're based in Alberta, Alberta's{' '}
          <Term>Personal Information Protection Act (PIPA)</Term> applies to us
          as well. Write to us in plain language — you don't need to cite a
          statute to get an answer.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <LegalList>
        <li>
          <Term>Your account.</Term> Email address, display name, and whether
          your email is verified. Your password is stored only as a bcrypt
          hash — we cannot read it. If you turn on two-factor authentication we
          store the shared secret your authenticator app uses; we never store
          the six-digit codes.
        </li>
        <li>
          <Term>Sign-in through Google or GitHub.</Term> If you use SSO we
          receive your email address, whether the provider says it's verified,
          and your display name. We do not receive your password, your
          contacts, or anything else in your account there.
        </li>
        <li>
          <Term>Your pets.</Term> Photos, names, species, breed, birthday, bio,
          traits, and whether the pet's share page is public.
        </li>
        <li>
          <Term>Your activity.</Term> Swipes and votes, liked-pets history,
          follows, comments, reactions, community posts, park check-ins and
          reviews, play dates, adoption inquiries, pet transfers, blocks,
          reports you file, beta feedback, and support tickets.
        </li>
        <li>
          <Term>Location you give us.</Term> Coordinates attached to lost &amp;
          found reports, sightings, park check-ins, and lost-pet alert
          subscriptions. How we publish these is its own section — see{' '}
          <a href="#location" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">Location</a>.
        </li>
        <li>
          <Term>Donations.</Term> If you donate through Fetchpawz we store the
          amount, currency, recipient, status, your optional message, and
          Stripe's identifiers for the payment. <Term>We never see or store
          your card number</Term> — card details go directly to Stripe.
        </li>
        <li>
          <Term>Support tickets.</Term> Your message and replies, our replies,
          and internal triage notes staff add to your ticket. Those internal
          notes are never shown to you in the app; if you ask for a copy of
          your data, they're included.
        </li>
        <li>
          <Term>Technical logs.</Term> Standard request logs, which include your
          IP address and browser user-agent, plus error reports. We also record
          the IP address of each successful sign-in in a security audit log, so
          you and we can tell a real login from a stolen one.
        </li>
        <li>
          <Term>Waitlist.</Term> If you ask for an invite, your email address,
          until you're invited or you ask us to drop it.
        </li>
      </LegalList>
    ),
  },
  {
    id: 'where-it-comes-from',
    title: 'Where it comes from',
    body: (
      <LegalList>
        <li><Term>From you</Term> — everything you type, upload, or choose.</li>
        <li>
          <Term>Automatically</Term> — logs, IP address, and browser details
          generated as you use the service.
        </li>
        <li>
          <Term>From other companies</Term> — Google or GitHub if you use SSO,
          and Stripe (payment status, never card data) if you donate.
        </li>
        <li>
          <Term>From other people</Term> — someone can report your content, log
          a sighting of your lost pet, send you a message about your lost-pet
          report, or scan your pet's QR collar tag and message you.
        </li>
      </LegalList>
    ),
  },
  {
    id: 'why',
    title: 'Why we collect it, and your consent',
    body: (
      <>
        <p>
          We use personal information to run Fetchpawz and for nothing else:
          showing pets in the feed, counting votes and awarding the weekly
          crowns, running Lost &amp; Found and its alerts, delivering the emails
          you'd expect, processing donations, answering support tickets,
          moderating content, preventing abuse and fraud, keeping the service
          running, and meeting our legal obligations.
        </p>
        <p>
          You consent to the obvious operational uses by creating an account and
          using the service. Anything beyond that — a public pet share page,
          location features, marketing email — is a separate choice you make and
          can reverse. <Term>You can withdraw consent at any time</Term> by
          unsubscribing, turning off a feature, deleting content, or emailing
          us. If you withdraw consent for something the account can't work
          without — storing your email address, for instance — the practical
          result is that we close the account, and we'll tell you that before
          acting.
        </p>
        <p>
          If we ever want to use your information for a new purpose that isn't
          described here, we'll ask you first.
        </p>
      </>
    ),
  },
  {
    id: 'public',
    title: "What's public, and what search engines see",
    body: (
      <>
        <p>
          Some of Fetchpawz is deliberately public. It's worth knowing exactly
          which parts, because "public" on the open web is different from
          "visible to other members".
        </p>
        <LegalList>
          <li>
            <Term>Inside the app,</Term> your display name, pets, and activity
            are visible to other signed-in members.
          </li>
          <li>
            <Term>Pet share pages</Term> at <code className="text-sm">/pets/…</code>{' '}
            are on the open web and visible to anyone with the link. You can
            turn a pet's share page off in the pet editor, and doing so also
            stops a QR tag from resolving to it.
          </li>
          <li>
            <Term>Lost-pet reports you mark public</Term> are visible to anyone,
            generate a link preview when shared, and — while the report is still
            open — <Term>are listed in our sitemap so search engines can index
            them</Term>. When you mark a report resolved, the page switches to
            "noindex" and drops out of the sitemap, though search engines may
            take a while to catch up.
          </li>
          <li>
            <Term>The signed-in app and the admin panel are excluded</Term> from
            search engines in our robots.txt.
          </li>
          <li>
            <Term>QR collar tags</Term> resolve to the pet's public share page.
            Anyone holding the tag can send you a message; the tag code is what
            authorizes that, so a share page alone can't be used to email you.
          </li>
        </LegalList>
        <p>
          Once something is public, other people and search engines can copy,
          cache, or screenshot it. We can take a page down from Fetchpawz. We
          cannot un-share what has already been copied elsewhere.
        </p>
      </>
    ),
  },
  {
    id: 'location',
    title: 'Location, and how we blur it',
    body: (
      <>
        <p>
          A lost-pet report's last-seen point is usually someone's home, and the
          pages are public. So we never show it.
        </p>
        <LegalList>
          <li>
            <Term>We publish a separate, offset point.</Term> When you file a
            report or a sighting, we generate a random offset with a
            cryptographic random number generator, once, and store the shifted
            point as its own value. Everyone but you sees only that. Nothing
            recalculates it from the report's ID or anything else a visitor can
            see, so it cannot be reversed.
          </li>
          <li>
            <Term>Widening your privacy radius does not republish the point.</Term>{' '}
            Two published points for one real location can be solved back to the
            real one, and the person asking for more privacy would be the one
            harmed. We regenerate only when there's no point yet, or when a
            narrower radius would make the displayed "within ~N m" label untrue.
          </li>
          <li>
            <Term>Nearby search matches on the published point,</Term> not the
            real one — otherwise repeated searches would triangulate the exact
            spot without ever opening the page.
          </li>
          <li>
            <Term>You keep your own true coordinates,</Term> and proximity alert
            emails are decided server-side using them, without revealing them to
            the recipients.
          </li>
        </LegalList>
        <p>
          <Term>Browser location.</Term> If you grant permission, we use your
          device's location to center maps and prefill a location picker. It's
          cached in your browser's local storage for up to 24 hours and is not
          sent to us unless you submit it as part of a report, check-in, or
          alert subscription.
        </p>
        <p>
          <Term>IP geolocation.</Term> If you don't grant permission, your
          browser may make one request to{' '}
          <Ext href="https://ipapi.co/privacy/">ipapi.co</Ext> for a city-level
          guess so maps don't open on the wrong continent. That request comes
          from your browser, which means <Term>ipapi.co receives your IP
          address</Term>. We don't store the result on our servers, and the
          lookup can be switched off entirely for a deployment.
        </p>
        <p>
          <Term>Map tiles.</Term> Maps are drawn with tiles from the{' '}
          <Ext href="https://osmfoundation.org/wiki/Privacy_Policy">
            OpenStreetMap Foundation
          </Ext>
          , so their servers receive your IP address and the map area you're
          looking at.
        </p>
      </>
    ),
  },
  {
    id: 'photos',
    title: 'Photos and automated screening',
    body: (
      <>
        <p>
          Every uploaded photo is sent to Sightengine for automated screening
          before it can appear publicly. If the check flags the image — or if
          the check fails outright — the photo is held and put in a queue for a
          human admin to review.
        </p>
        <p>
          A held photo stays visible to you, badged "In review", and to nobody
          else. It can't become your pet's main photo while it's held. This is
          automated processing that decides whether your content appears, so:
          a person makes the final call on anything flagged, and you can email
          us to contest a decision.
        </p>
      </>
    ),
  },
  {
    id: 'email',
    title: 'Email we send, and turning it off',
    body: (
      <>
        <p>We split email into two kinds, and treat them differently on purpose.</p>
        <LegalList>
          <li>
            <Term>Transactional</Term> — email verification, password reset,
            email-change confirmation, a relayed message about your lost pet or
            your QR tag, a pet transfer invitation, and replies to your support
            ticket. These answer something you did, so they have no unsubscribe
            link. Closing your account is how you stop them.
          </li>
          <li>
            <Term>Bulk</Term> — the digest, weekly recap, admin announcements,
            and lost-pet proximity alerts. Every one carries a one-click
            unsubscribe (the RFC 8058 header your mail client uses) and a footer
            link. The digest and the weekly recap are <Term>off by default</Term>.
          </li>
        </LegalList>
        <p>
          Unsubscribe links work without signing in, because your mail client
          has no session. The link can only ever switch one list off for the one
          person it names.
        </p>
        <p>
          <Term>We never show your email address to another member</Term> —
          including when we relay a message about your lost pet or your pet's
          QR tag. The person who receives a relayed message can reply to the
          sender, because the sender chose to reach out. It does not work in
          the other direction.
        </p>
      </>
    ),
  },
  {
    id: 'providers',
    title: 'Who else touches your data',
    body: (
      <>
        <p>
          These companies process data on our behalf, limited to what their job
          requires:
        </p>
        <LegalTable
          caption="Service providers and what they process"
          head={['Provider', 'What it does, and where']}
          rows={[
            ['Resend', 'Delivers our email. United States.'],
            ['Stripe', 'Processes donations and settles funds to rescues. United States and Ireland.'],
            ['Sightengine', 'Automated screening of uploaded photos. France.'],
            ['Sentry', 'Receives error reports so we can fix crashes. United States.'],
            ['Shopify', 'Runs the shop, including checkout and payment — your browser talks to Shopify directly. Canada.'],
            ['ipapi.co', 'Optional city-level IP lookup, requested by your browser. United States.'],
            ['OpenStreetMap Foundation', 'Serves map tiles to your browser. United Kingdom and EU.'],
            ['DigitalOcean', 'Hosts our servers, database, uploaded photos, and backups.'],
          ]}
        />
        <p>
          <Term>Your information is stored and processed outside Canada</Term>,
          including in the United States and the European Union. While it's
          there it is subject to the laws of those countries, and their courts
          and law-enforcement agencies may be able to compel access to it. We
          are telling you this because PIPEDA requires it, and because it's
          true of essentially every service of this kind.
        </p>
        <p>
          Apart from these providers, we share personal information only when
          the law requires it, or to establish or defend a legal claim, or to
          address an urgent risk to someone's safety.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <>
        <p>
          <Term>No advertising cookies, and no analytics.</Term> We don't run
          Google Analytics, tracking pixels, or any cross-site tracking. That's
          why you've never seen a cookie banner here.
        </p>
        <p>Your browser's local storage holds:</p>
        <LegalList>
          <li>your login session, so you stay signed in;</li>
          <li>your light/dark theme preference;</li>
          <li>your cached map center, for up to 24 hours;</li>
          <li>which one-time tips, prompts, and banners you've dismissed;</li>
          <li>your cart, if you use the demo shop.</li>
        </LegalList>
        <p>
          Clearing your browser storage clears all of it and signs you out. If
          you check out through Shopify, Shopify sets its own cookies under its
          own policy.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep things',
    body: (
      <>
        <LegalTable
          caption="Retention periods by data type"
          head={['What', 'How long we keep it']}
          rows={[
            ['Account and pets', 'Until you delete your account — read the next paragraph, it matters'],
            ['Photos you delete', 'Removed from storage when you delete them'],
            ['Sign-in audit records, including IP', 'Kept with the account'],
            ['Donation records', 'Kept for financial and tax records even after you close your account; the link to your user account is severed, and only the recipient name and amount remain'],
            ['Support tickets', 'Kept so there is a history of what we told you'],
            ['Database and photo backups', 'Rolling 14 days, then overwritten'],
            ['Waitlist entries', 'Until invited, or until you ask us to remove you'],
          ]}
        />
        <p>
          <Term>About deleting your account.</Term> The delete button in the app
          deactivates your account immediately: you're signed out, and your
          profile, your pets, and your public pages disappear from Fetchpawz.
          Being straight with you — today that is a deactivation, not an
          erasure. The underlying database rows remain.
        </p>
        <p>
          <Term>If you want your data actually erased, email <Mail /> and we
          will erase it and confirm when it's done.</Term> We're working on
          making the in-app button do the full erasure itself; until it does,
          this policy describes what the button really does rather than what
          we'd like it to do. Records we're required to keep — donation
          receipts, for example — survive erasure with your identifying details
          removed, and copies inside backups age out on the 14-day rotation.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights, and how to use them',
    body: (
      <>
        <p>Under PIPEDA and Alberta's PIPA you can:</p>
        <LegalList>
          <li>
            <Term>Ask what we hold about you</Term> and get a copy, along with
            how it's been used and who it's been disclosed to.
          </li>
          <li>
            <Term>Correct anything inaccurate.</Term> Most of it you can edit
            yourself in the app; email us for the rest.
          </li>
          <li>
            <Term>Withdraw consent</Term> for anything optional — see{' '}
            <a href="#why" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">consent</a>.
          </li>
          <li><Term>Ask us to erase your data</Term>, as described above.</li>
          <li><Term>Complain</Term>, to us or to a regulator.</li>
        </LegalList>
        <p>
          Email <Mail /> from the address on your account — that's how we verify
          it's you. <Term>We'll respond within 30 days</Term>, at no charge. If
          a request is genuinely large enough that we'd need to charge for it,
          we'll tell you the cost first and let you decide. If we refuse a
          request, we'll tell you why and how to challenge it.
        </p>
        <p>
          If we haven't resolved something to your satisfaction, you can
          complain to the{' '}
          <Ext href="https://www.priv.gc.ca/">
            Office of the Privacy Commissioner of Canada
          </Ext>{' '}
          or, in Alberta, the{' '}
          <Ext href="https://oipc.ab.ca/">
            Office of the Information and Privacy Commissioner of Alberta
          </Ext>
          . You don't have to go through us first, but we'd rather you gave us
          the chance to fix it.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <>
        <LegalList>
          <li>Traffic is encrypted with TLS, and the site is HSTS-enabled.</li>
          <li>Passwords are stored as bcrypt hashes and are never recoverable.</li>
          <li>
            Two-factor authentication is available on every account, and we
            recommend it.
          </li>
          <li>
            Rate limiting protects sign-in, password reset, and other sensitive
            endpoints.
          </li>
          <li>
            Administrative actions are restricted to staff accounts and written
            to an audit log.
          </li>
          <li>Backups run daily and are rotated.</li>
        </LegalList>
        <p>
          No system is perfectly secure. If a breach of our security creates a{' '}
          <Term>real risk of significant harm</Term> to you, we will notify you
          and the Privacy Commissioner of Canada as soon as feasible, as PIPEDA
          requires, and we keep a record of breaches whether or not they meet
          that threshold.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        Fetchpawz is not directed at children under 13, and we don't knowingly
        collect their personal information. If you're between 13 and 17, a
        parent or guardian should review this policy with you. If you believe a
        child under 13 has an account, tell us at <Mail /> and we'll remove it
        and the data with it.
      </p>
    ),
  },
  {
    id: 'never',
    title: 'What we will never do',
    body: (
      <>
        <p>
          We don't sell your personal information, and we don't share it with
          data brokers. We don't run behavioural advertising or ad targeting.
          We don't show your email address to other members. We don't license
          your pets' photos to anyone for advertising or for training AI models.
        </p>
        <p>
          The app currently contains an ad placeholder and a rewarded-video flow
          that is not connected to any ad network — nothing about you is sent to
          an advertiser today. <Term>If we ever turn on real ads, we will update
          this policy and tell you before it goes live.</Term>
        </p>
        <p>
          Because we don't track you across sites, there's nothing for a Do Not
          Track or Global Privacy Control signal to switch off. We honour them
          by not doing it in the first place.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        Fetchpawz is in beta and this policy will evolve with it. We'll update
        the date at the top whenever it changes, and email account holders about
        anything that meaningfully changes how personal information is handled —
        before the change takes effect, where that's practical.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      documentTitle="Privacy · Fetchpawz"
      eyebrow="Privacy policy"
      title="Your data, plainly"
      lastUpdated={LAST_UPDATED}
      subtitle="What we collect, why we collect it, and what we will never do with it."
      summary={
        <>
          <p>
            We don't sell your data, run ads, or track you across the web. There
            are no analytics on this site.
          </p>
          <p>
            Pet share pages and open lost-pet reports are public and can be
            indexed by search engines. Lost-pet locations shown to other people
            are deliberately offset and can't be reversed.
          </p>
          <p>
            The delete button in the app deactivates your account rather than
            erasing it. Email us and we'll erase it properly.
          </p>
        </>
      }
      intro={
        <p>
          Fetchpawz is a place to show off your pet, not a data business. This
          page explains what information we handle and what you can do about it.
          We've tried to write it the way we'd want to read it, including the
          parts that are less flattering than we'd like. If anything is unclear,
          email <Mail /> and a person will answer.
        </p>
      }
      sections={SECTIONS}
      footer={
        <>
          Questions about your data? Email <Mail /> or read the{' '}
          <Link
            to="/terms"
            className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </>
      }
    />
  );
}
