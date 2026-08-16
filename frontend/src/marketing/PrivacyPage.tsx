import { Link } from 'react-router-dom';
import LegalDoc, { LegalList, LegalTable, Term } from './LegalDoc';
import type { LegalSectionSpec } from './LegalDoc';

const LAST_UPDATED = 'August 16, 2026';
const CONTACT = 'fetchpawz.inc@gmail.com';

function Mail() {
  return (
    <a
      href={`mailto:${CONTACT}`}
      className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
    >
      {CONTACT}
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

function Ref({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a href={`#${id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
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
          Canada. We operate the Fetchpawz website and application. We are
          responsible for the personal information described in this policy,
          including information held on our behalf by the organizations listed
          in <Ref id="providers">Service providers</Ref>.
        </p>
        <p>
          The Personal Information Protection and Electronic Documents Act
          (PIPEDA) requires an organization to designate an individual
          accountable for its privacy practices. Enquiries for that individual
          may be sent to <Mail />. Alberta's Personal Information Protection Act
          also applies to our activities.
        </p>
      </>
    ),
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: (
      <LegalList>
        <li>
          <Term>Account information.</Term> Your email address, display name,
          and email verification status. Passwords are stored only as bcrypt
          hashes and cannot be read by us. Where you enable two-factor
          authentication, we store the shared secret used by your authenticator
          application. We do not store the generated codes.
        </li>
        <li>
          <Term>Third-party sign-in.</Term> Where you sign in using Google or
          GitHub, we receive your email address, the provider's indication of
          whether that address is verified, and your display name. We do not
          receive your password or any other information held by that provider.
        </li>
        <li>
          <Term>Pet profiles.</Term> Photographs, names, species, breed, date of
          birth, biography, traits, and the visibility setting for each pet's
          share page.
        </li>
        <li>
          <Term>Activity.</Term> Votes and swipes, liked-pet history, follows,
          comments, reactions, community posts, park check-ins and reviews, play
          dates, adoption enquiries, pet transfers, blocks, reports you submit,
          beta feedback, and support tickets.
        </li>
        <li>
          <Term>Location you provide.</Term> Coordinates attached to lost and
          found reports, sightings, park check-ins, and lost-pet alert
          subscriptions. <Ref id="location">Location data</Ref> describes how
          these are published.
        </li>
        <li>
          <Term>Donations.</Term> Where you donate through Fetchpawz, we store
          the amount, currency, recipient, status, any message you include, and
          the identifiers assigned by Stripe. Card details are submitted
          directly to Stripe and are never received or stored by us.
        </li>
        <li>
          <Term>Support correspondence.</Term> Your ticket and replies, our
          replies, and internal notes recorded by staff. Internal notes are not
          displayed to you within the application. They are included in the
          response to an access request.
        </li>
        <li>
          <Term>Technical information.</Term> Server request logs, which record
          your IP address and browser user-agent, together with error reports.
          The IP address associated with each successful sign-in is recorded in
          a security audit log.
        </li>
        <li>
          <Term>Waitlist.</Term> Your email address, where you request an
          invitation.
        </li>
      </LegalList>
    ),
  },
  {
    id: 'sources',
    title: 'Sources of information',
    body: (
      <>
        <p>We collect personal information from four sources:</p>
        <LegalList>
          <li>directly from you, where you enter, upload, or select it;</li>
          <li>automatically, through the ordinary operation of the service;</li>
          <li>
            from Google or GitHub, where you use third-party sign-in, and from
            Stripe, where you make a donation;
          </li>
          <li>
            from other users, who may report your content, record a sighting of
            your pet, or contact you through a QR collar tag.
          </li>
        </LegalList>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use information',
    body: (
      <>
        <p>
          We use personal information to operate Fetchpawz. The purposes are:
        </p>
        <LegalList>
          <li>displaying pets in the rating feed and recording votes;</li>
          <li>calculating weekly standings and awarding crowns;</li>
          <li>operating Lost &amp; Found, including proximity alerts;</li>
          <li>
            sending the email described in <Ref id="email">Email</Ref>;
          </li>
          <li>processing donations;</li>
          <li>responding to support tickets;</li>
          <li>moderating content and investigating abuse;</li>
          <li>maintaining the security and availability of the service;</li>
          <li>complying with our legal obligations.</li>
        </LegalList>
        <p>
          We do not use personal information for any other purpose without first
          obtaining your consent.
        </p>
      </>
    ),
  },
  {
    id: 'consent',
    title: 'Consent',
    body: (
      <>
        <p>
          You consent to the uses described above by creating an account and
          using Fetchpawz. Features that are not required for the service to
          function, including public share pages, location features, and
          non-transactional email, are subject to a separate choice that you may
          change at any time.
        </p>
        <p>
          You may withdraw consent by unsubscribing, disabling the relevant
          feature, deleting the content in question, or writing to us. Where
          consent is withdrawn in respect of information the account cannot
          operate without, we will close the account, and we will tell you
          before doing so.
        </p>
        <p>
          Where we propose to use personal information for a purpose not
          described in this policy, we will seek your consent first.
        </p>
      </>
    ),
  },
  {
    id: 'public',
    title: 'Public content and search engines',
    body: (
      <>
        <p>
          Parts of Fetchpawz are publicly accessible by design. The following
          describes what is visible, and to whom.
        </p>
        <LegalList>
          <li>
            Within the application, your display name, pets, and activity are
            visible to other signed-in users.
          </li>
          <li>
            Pet share pages are accessible to any person holding the link,
            without signing in. You may disable a pet's share page in the pet
            editor. Disabling it also prevents a QR collar tag from resolving to
            that pet.
          </li>
          <li>
            Lost-pet reports marked public are accessible to any person,
            generate a preview when shared, and, for as long as the report
            remains open, are listed in our sitemap for indexing by search
            engines. When a report is marked resolved, the page is marked
            "noindex" and removed from the sitemap. Search engines may take time
            to reflect that change.
          </li>
          <li>
            The signed-in application and the administrative interface are
            excluded from search engines by our robots.txt file.
          </li>
          <li>
            QR collar tags resolve to a pet's public share page. A person
            holding the tag may send you a message, which is authorized by the
            tag code rather than by access to the share page.
          </li>
        </LegalList>
        <p>
          Content that has been publicly accessible may have been copied,
          cached, or archived by others. We can remove material from Fetchpawz,
          but we have no means of removing copies held elsewhere.
        </p>
      </>
    ),
  },
  {
    id: 'location',
    title: 'Location data',
    body: (
      <>
        <p>
          The last known location in a lost-pet report is frequently the owner's
          home address, and lost-pet pages are public. We therefore do not
          publish it.
        </p>
        <LegalList>
          <li>
            <Term>Published coordinates.</Term> When a report or sighting is
            created, we generate a random offset using a cryptographically
            secure random number generator and store the resulting point as a
            separate value. Users other than the owner see only that point. It
            is not recalculated from the report identifier or from any other
            value available to a visitor, and it cannot be reversed.
          </li>
          <li>
            <Term>Increasing the privacy radius.</Term> Increasing the radius
            does not republish the point. Two published points derived from a
            single true location can be resolved back to that location, and the
            user affected would be the one seeking greater privacy. A new point
            is generated only where none exists, or where a reduced radius would
            render the displayed distance inaccurate.
          </li>
          <li>
            <Term>Proximity searches.</Term> The nearby-report search matches
            against the published point. Matching against the recorded location
            would allow repeated searches to determine it precisely without
            opening the report.
          </li>
          <li>
            <Term>Owner access.</Term> You retain access to the recorded
            coordinates of your own reports. Proximity alerts are calculated on
            our servers using those coordinates and do not disclose them to
            recipients.
          </li>
        </LegalList>
        <p>
          <Term>Device location.</Term> Where you grant permission, your
          device's location is used to centre maps and to pre-fill a location
          field. It is held in your browser for up to 24 hours and is not
          transmitted to us unless you submit it with a report, check-in, or
          alert subscription.
        </p>
        <p>
          <Term>IP geolocation.</Term> Where permission is not granted, your
          browser may make a single request to{' '}
          <Ext href="https://ipapi.co/privacy/">ipapi.co</Ext> to obtain an
          approximate location at city level. Because the request originates
          from your browser, ipapi.co receives your IP address. The result is not
          stored on our servers. This lookup can be disabled for a deployment.
        </p>
        <p>
          <Term>Map tiles.</Term> Maps are rendered using tiles served by the{' '}
          <Ext href="https://osmfoundation.org/wiki/Privacy_Policy">
            OpenStreetMap Foundation
          </Ext>
          . Their servers receive your IP address and the map area requested.
        </p>
      </>
    ),
  },
  {
    id: 'photos',
    title: 'Photograph screening',
    body: (
      <>
        <p>
          Photographs uploaded to Fetchpawz are submitted to Sightengine for
          automated screening before they become publicly visible. Where the
          screening flags an image, or where the screening request fails, the
          photograph is withheld and placed in a queue for review by a member of
          staff.
        </p>
        <p>
          A withheld photograph remains visible to you, marked "In review", and
          is not shown to other users. It cannot be set as a pet's primary
          photograph while withheld.
        </p>
        <p>
          Because this screening determines whether your content is displayed,
          every flagged photograph is reviewed by a person before a final
          decision is taken. You may contest a decision by writing to us.
        </p>
      </>
    ),
  },
  {
    id: 'email',
    title: 'Email',
    body: (
      <>
        <p>Fetchpawz sends two categories of email.</p>
        <p>
          <Term>Transactional email</Term> comprises address verification,
          password reset, email-change confirmation, relayed messages concerning
          a lost pet or a QR collar tag, pet transfer invitations, and replies to
          support tickets. This category carries no unsubscribe link, because
          each message responds to an action you have taken. Closing your account
          ends it.
        </p>
        <p>
          <Term>Bulk email</Term> comprises the digest, the weekly recap,
          administrative announcements, and lost-pet proximity alerts. Every
          message in this category carries a one-click unsubscribe header, as
          required by RFC 8058, together with an unsubscribe link in the footer.
          The digest and the weekly recap are disabled by default.
        </p>
        <p>
          Unsubscribe links operate without signing in, because a mail client
          holds no session. A link can only disable one category for the
          individual it names.
        </p>
        <p>
          We do not disclose your email address to other users. Where we relay a
          message concerning a lost pet or a QR collar tag, the recipient may
          reply to the sender, who initiated the contact. The reverse does not
          apply.
        </p>
      </>
    ),
  },
  {
    id: 'providers',
    title: 'Service providers',
    body: (
      <>
        <p>
          The following organizations process personal information on our
          behalf, limited to what their function requires.
        </p>
        <LegalTable
          caption="Service providers and their function"
          head={['Provider', 'Function and location']}
          rows={[
            ['Resend', 'Delivery of email. United States.'],
            ['Stripe', 'Processing of donations and settlement to rescue organizations. United States and Ireland.'],
            ['Sightengine', 'Automated screening of uploaded photographs. France.'],
            ['Sentry', 'Receipt of error reports. United States.'],
            ['Shopify', 'Operation of the shop, including checkout and payment. Your browser communicates with Shopify directly. Canada.'],
            ['ipapi.co', 'Optional approximate location lookup, requested by your browser. United States.'],
            ['OpenStreetMap Foundation', 'Delivery of map tiles to your browser. United Kingdom and European Union.'],
            ['DigitalOcean', 'Hosting of our servers, database, uploaded photographs, and backups.'],
          ]}
        />
        <p>
          Personal information is stored and processed outside Canada, including
          in the United States and the European Union. While outside Canada it is
          subject to the laws of the jurisdiction in which it is held, and may be
          accessible to the courts and law enforcement agencies of that
          jurisdiction.
        </p>
        <p>
          We otherwise disclose personal information only where required by law,
          where necessary to establish or defend a legal claim, or where
          necessary to address an immediate risk to the safety of an individual.
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
          Fetchpawz does not use advertising cookies, and it does not operate
          analytics or cross-site tracking.
        </p>
        <p>Your browser's local storage holds:</p>
        <LegalList>
          <li>your session, which keeps you signed in;</li>
          <li>your light or dark theme preference;</li>
          <li>a cached map centre, retained for up to 24 hours;</li>
          <li>a record of the one-time prompts and banners you have dismissed;</li>
          <li>your cart, where you use the demonstration shop.</li>
        </LegalList>
        <p>
          Clearing your browser storage removes each of these and signs you out.
          Shopify sets its own cookies during checkout, under its own policy.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Retention, deletion, and erasure',
    body: (
      <>
        <LegalTable
          caption="Retention periods by category of information"
          head={['Category', 'Retention period']}
          rows={[
            ['Account and pet profiles', 'Until the account is deleted, subject to the note on deletion below'],
            ['Photographs you delete', 'Removed from storage on deletion'],
            ['Sign-in audit records, including IP address', 'Retained with the account'],
            ['Donation records', 'Retained for financial and tax purposes after an account is closed. The link to the user account is severed, leaving the recipient name and amount'],
            ['Support tickets', 'Retained as a record of the correspondence'],
            ['Database and photograph backups', 'Rotated on a 14-day cycle'],
            ['Waitlist entries', 'Until an invitation is issued, or until removal is requested'],
          ]}
        />
        <p>
          <Term>Deletion.</Term> Selecting delete within the application
          deactivates your account immediately. You are signed out, and your
          profile, your pets, and your public pages are withdrawn from
          Fetchpawz. This operation is a deactivation. The underlying records
          are retained.
        </p>
        <p>
          <Term>Erasure.</Term> To have your personal information erased, write
          to <Mail />. We will erase it and confirm once that is complete.
          Records we are required to retain, such as donation records, survive
          erasure with identifying details removed. Copies held in backups are
          removed as those backups age out on the cycle stated above.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Under PIPEDA and Alberta's Personal Information Protection Act, you
          may:
        </p>
        <LegalList>
          <li>
            request access to the personal information we hold about you,
            together with an account of how it has been used and to whom it has
            been disclosed;
          </li>
          <li>
            request correction of inaccurate information, most of which may also
            be corrected directly within the application;
          </li>
          <li>withdraw consent, as described in <Ref id="consent">Consent</Ref>;</li>
          <li>request erasure of your personal information;</li>
          <li>make a complaint.</li>
        </LegalList>
        <p>
          Requests should be sent to <Mail /> from the address registered to
          your account, which is how we verify identity. We will respond within
          30 days, at no charge. Where a request would require disproportionate
          effort to fulfil, we will provide an estimate of any cost before
          proceeding. Where we decline a request, we will give reasons and
          explain how the decision may be challenged.
        </p>
        <p>
          A complaint may be made to us. It may also be made to the{' '}
          <Ext href="https://www.priv.gc.ca/">
            Office of the Privacy Commissioner of Canada
          </Ext>{' '}
          or to the{' '}
          <Ext href="https://oipc.ab.ca/">
            Office of the Information and Privacy Commissioner of Alberta
          </Ext>
          . You are not required to raise a complaint with us first.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <>
        <p>We maintain the following safeguards:</p>
        <LegalList>
          <li>
            traffic is encrypted in transit using TLS, with HTTP Strict
            Transport Security enabled;
          </li>
          <li>passwords are stored as bcrypt hashes and cannot be recovered;</li>
          <li>two-factor authentication is available on all accounts;</li>
          <li>
            rate limiting is applied to sign-in, password reset, and other
            sensitive endpoints;
          </li>
          <li>
            administrative functions are restricted to staff accounts and
            recorded in an audit log;
          </li>
          <li>backups are taken daily and rotated.</li>
        </LegalList>
        <p>
          No safeguard is complete. Where a breach of our security safeguards
          creates a real risk of significant harm to an individual, we will
          report it to the Privacy Commissioner of Canada and notify the affected
          individuals as soon as feasible, as PIPEDA requires. We maintain a
          record of every breach of security safeguards, whether or not it meets
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
        Fetchpawz is not directed at children under 13, and we do not knowingly
        collect their personal information. Where a user is between 13 and 17, a
        parent or guardian should review this policy with them. If you believe a
        child under 13 holds an account, write to <Mail />, and the account and
        the information associated with it will be removed.
      </p>
    ),
  },
  {
    id: 'advertising',
    title: 'Advertising, tracking, and data sales',
    body: (
      <>
        <p>
          We do not sell personal information, and we do not disclose it to data
          brokers. We do not operate behavioural advertising or ad targeting. We
          do not disclose your email address to other users. We do not license
          photographs uploaded to Fetchpawz for advertising or for the training
          of machine learning models.
        </p>
        <p>
          The application contains an advertising placeholder and a
          rewarded-video flow that is not connected to any advertising network.
          No information about you is transmitted to an advertiser. Should
          advertising be introduced, this policy will be amended and notice given
          before the change takes effect.
        </p>
        <p>
          Because we do not track users across sites, Do Not Track and Global
          Privacy Control signals have no applicable practice to disable.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        Fetchpawz is in beta, and this policy will change as the service
        develops. The date at the head of this page will be updated when it
        does. Where a change materially affects the handling of personal
        information, we will notify account holders by email before it takes
        effect, where that is practicable.
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
      subtitle="What Fetchpawz collects, and the choices available to you."
      summary={
        <>
          <p>
            We do not sell personal information and we do not use it for
            advertising. This site operates no analytics and no cross-site
            tracking.
          </p>
          <p>
            Pet share pages and open lost-pet reports are publicly accessible and
            may be indexed by search engines.
          </p>
          <p>
            Lost-pet locations shown to other users are offset from the location
            recorded. The offset is generated once and cannot be reversed.
          </p>
          <p>
            Deleting your account within the application deactivates it. It does
            not erase the underlying records. Requests for erasure are honoured.
          </p>
        </>
      }
      summaryNote="This summary is provided for convenience and does not form part of the policy."
      intro={
        <p>
          This policy explains what personal information Fetchpawz collects, how
          it is used, who it is shared with, and the choices available to you. It
          applies to the Fetchpawz website, the Fetchpawz application, and the
          public pages we host on your behalf. If any part of it is unclear,
          write to <Mail />.
        </p>
      }
      sections={SECTIONS}
      footer={
        <>
          Questions about your personal information may be sent to <Mail />. See
          also the{' '}
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
