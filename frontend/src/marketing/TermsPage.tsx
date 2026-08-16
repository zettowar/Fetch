import { Link } from 'react-router-dom';
import LegalDoc, { LegalList, Term } from './LegalDoc';
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

function PrivacyLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      to="/privacy"
      className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
    >
      {children}
    </Link>
  );
}

const SECTIONS: LegalSectionSpec[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: (
      <>
        <p>
          These terms form an agreement between you and Fetchpawz Inc.
          ("Fetchpawz", "we", "us"), a company based in Alberta, Canada. By
          creating an account or otherwise using Fetchpawz, you accept them. If
          you do not accept them, do not use the service.
        </p>
        <p>
          Our <PrivacyLink>Privacy Policy</PrivacyLink> forms part of this
          agreement. Where you accept these terms on behalf of an organization,
          including a rescue organization, you confirm that you have authority to
          bind it.
        </p>
        <p>
          Fetchpawz is an invite-only beta service, and its features are subject
          to change.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    body: (
      <>
        <p>
          You must be at least 13 years of age to use Fetchpawz. Where a user is
          between 13 and 17, a parent or guardian must review these terms and
          accept them on that user's behalf.
        </p>
        <p>
          Each individual may hold one account. Rescue organizations use an
          organization account, which we approve individually. You may not use
          Fetchpawz where we have previously terminated your account, or where
          the law applicable to you prohibits it.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: (
      <p>
        You are responsible for providing accurate registration information and
        keeping it current, for maintaining the confidentiality of your
        credentials, and for activity conducted through your account.
        Two-factor authentication is available on all accounts, and we recommend
        enabling it. Notify us at <Mail /> if you believe your account has been
        accessed without your authorization. Accounts may not be sold, shared,
        or transferred.
      </p>
    ),
  },
  {
    id: 'licence',
    title: 'Licence to use Fetchpawz',
    body: (
      <>
        <p>
          We grant you a personal, limited, non-exclusive, non-transferable, and
          revocable licence to use Fetchpawz for its intended purpose.
        </p>
        <p>
          All rights in the service, including the application, the website, the
          Fetchpawz name, the logo, and the design, remain with us. You may not
          copy them, reverse engineer the service, resell access to it, or remove
          any proprietary notice.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <>
        <p>You retain ownership of the photographs and text you post.</p>
        <p>
          To operate the service, you grant us a worldwide, non-exclusive, and
          royalty-free licence to host, store, reproduce, resize, re-encode, and
          display your content, and to provide it to the suppliers who perform
          those functions on our behalf, including our hosting and
          content-screening providers. The licence is granted for that purpose
          only.
        </p>
        <p>
          We will obtain your permission before featuring your pet in
          advertising or on our marketing site.
        </p>
        <p>
          We do not sell content uploaded to Fetchpawz, and we do not license it
          for the training of machine learning models.
        </p>
        <p>
          The licence ends when you delete the content or your account. It
          continues to the extent necessary in respect of copies already
          distributed by other users, cached copies held by search engines, and
          copies held in backups until those backups age out. The{' '}
          <PrivacyLink>Privacy Policy</PrivacyLink> sets out the applicable
          periods.
        </p>
        <p>By posting content you represent that:</p>
        <LegalList>
          <li>you own it or hold the permissions necessary to post it;</li>
          <li>
            the pet is yours or, in the case of a rescue account, one your
            organization is authorized to list;
          </li>
          <li>
            it does not contain another person's private information, or a
            recognizable image of another person's child, without their consent.
          </li>
        </LegalList>
        <p>
          Where you send us feedback or suggestions, we may use them without
          restriction and without obligation to you. Please do not send us
          confidential information.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>Be the person your pet thinks you are. You must not:</p>
        <LegalList>
          <li>
            harass or threaten another user, or publish another person's private
            information;
          </li>
          <li>
            post content that is hateful, sexually explicit, violent, or
            unlawful;
          </li>
          <li>
            impersonate another person, a rescue organization, a veterinarian, or
            Fetchpawz staff;
          </li>
          <li>
            submit false lost-pet reports, false sightings, or false claims to
            have found an animal;
          </li>
          <li>
            post content depicting animal cruelty or organized animal fighting;
          </li>
          <li>use Fetchpawz to sell or breed animals commercially;</li>
          <li>
            manipulate votes, rankings, or crowns, whether through additional
            accounts, automated agents, or coordinated voting;
          </li>
          <li>
            scrape, crawl, or bulk-download the service other than as permitted
            by our robots.txt file, or use content obtained from Fetchpawz to
            train machine learning models;
          </li>
          <li>
            circumvent rate limits, invitation requirements, swipe allowances, or
            other technical restrictions;
          </li>
          <li>
            probe or test the security of the service without our written
            permission;
          </li>
          <li>
            claim a QR collar tag for an animal you do not own, or use a contact
            relay for a purpose other than a genuine message concerning that
            animal;
          </li>
          <li>send unsolicited messages, or resell the service.</li>
        </LegalList>
        <p>
          Security researchers who identify a vulnerability are asked to report
          it to <Mail />.
        </p>
      </>
    ),
  },
  {
    id: 'moderation',
    title: 'Moderation and enforcement',
    body: (
      <>
        <p>
          Photographs are screened automatically before they are displayed
          publicly, and images that are flagged are withheld pending review by a
          member of staff. We may review reported content. We are not obliged to
          monitor content generally, and we do not endorse content posted by
          users.
        </p>
        <p>
          We may remove content, restrict access to features, and suspend or
          terminate accounts that breach these terms. Where there is a risk of
          harm, we may act without prior notice. Repeated breaches will result in
          termination.
        </p>
        <p>
          If you believe an enforcement decision was taken in error, write to{' '}
          <Mail />. The decision will be reviewed by a member of staff.
        </p>
      </>
    ),
  },
  {
    id: 'copyright',
    title: 'Copyright complaints',
    body: (
      <>
        <p>
          If you believe material on Fetchpawz infringes your copyright, send a
          notice to <Mail /> containing:
        </p>
        <LegalList>
          <li>identification of the work said to be infringed;</li>
          <li>the address of the material on Fetchpawz;</li>
          <li>your name and contact details;</li>
          <li>
            a statement that you believe in good faith that the use is not
            authorized;
          </li>
          <li>
            a statement that the information in the notice is accurate and that
            you are the owner of the right or are authorized to act on the
            owner's behalf.
          </li>
        </LegalList>
        <p>
          Under the notice-and-notice regime in section 41.25 of the Copyright
          Act (Canada), we forward complete notices to the user who posted the
          material. Separately, as a matter of our own policy, we remove material
          we determine to be infringing and notify the user, who may respond.
          Accounts subject to repeated infringement will be terminated.
        </p>
        <p>
          A person who knowingly makes a material misrepresentation in such a
          notice may be liable for the resulting damages.
        </p>
      </>
    ),
  },
  {
    id: 'public',
    title: 'Public pages and QR collar tags',
    body: (
      <>
        <p>
          Pet share pages are publicly accessible unless you disable them, and
          open lost-pet reports marked public may be indexed by search engines.
          The <PrivacyLink>Privacy Policy</PrivacyLink> identifies the pages
          concerned.
        </p>
        <p>
          Material that has been publicly accessible may have been copied by
          others. Removal from Fetchpawz does not extend to copies held
          elsewhere, over which we have no control.
        </p>
        <p>
          A QR collar tag allows a person who finds your pet to contact you. You
          may claim tags only for animals you own. We do not verify the identity
          of a person who scans a tag, and we are not responsible for their
          conduct.
        </p>
      </>
    ),
  },
  {
    id: 'lost-found',
    title: 'Lost & Found',
    body: (
      <>
        <p>
          Lost &amp; Found operates on reports submitted by users. We do not
          guarantee that a sighting is accurate, that an alert will reach any
          particular person, or that a missing animal will be recovered.
          Fetchpawz should not be your only channel. Contact local shelters,
          veterinary clinics, and municipal animal services.
        </p>
        <p>
          Locations displayed to other users are offset from the location
          recorded. You must not attempt to defeat that offset, and you must not
          publish another user's precise location.
        </p>
        <p className="rounded-xl border border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 p-4 text-gray-700 dark:text-gray-300">
          <Term>Safety.</Term> We do not verify the identity of any user. Fraud
          directed at the owners of missing animals is common. Do not send money
          to a person claiming to hold your pet. Arrange to meet in a public
          place during daylight hours, accompanied by another person, and ask for
          evidence that only the person holding the animal could provide.
        </p>
      </>
    ),
  },
  {
    id: 'rescues',
    title: 'Rescue accounts and adoption',
    body: (
      <>
        <p>
          Rescue accounts are reviewed and approved individually before an
          organization may list animals. Listings must be accurate, animals must
          be marked as adopted promptly, and enquiries from prospective adopters
          must be handled responsibly. Approval may be revoked where an account
          is misused.
        </p>
        <p>
          Fetchpawz is not a party to any adoption. We do not screen prospective
          adopters. We do not verify an organization's registration or charitable
          status beyond the review described above. We make no representation as
          to an animal's health, temperament, or history, and we do not handle
          adoption fees. The adoption agreement is between the adopter and the
          organization.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'Pet transfers',
    body: (
      <p>
        The transfer function moves a pet profile from one Fetchpawz account to
        another. It has no effect on legal ownership of the animal. It does not
        constitute a bill of sale, an adoption agreement, or evidence of
        ownership, and it should not be relied on as such. Arrangements
        concerning the animal are a matter between the users involved.
      </p>
    ),
  },
  {
    id: 'donations',
    title: 'Donations',
    body: (
      <>
        <p>
          Donations to Fetchpawz and to participating rescue organizations are
          processed through Stripe Checkout within the application. Card details
          are submitted directly to Stripe and are not received by us.
        </p>
        <LegalList>
          <li>
            Donations to rescue organizations are processed as Stripe Connect
            destination charges. Stripe processes the payment and settles the
            funds to the organization's own Stripe account. We may retain a
            platform fee to cover our costs. Where a fee applies, it is disclosed
            before payment.
          </li>
          <li>
            Donations are final and non-refundable, except where required by law
            or where we agree otherwise. A refund of a donation to a rescue
            organization is a matter for that organization, processed through
            Stripe.
          </li>
          <li>
            Donations made through Fetchpawz are not tax-deductible through us,
            and we do not issue tax receipts. Only a registered charity may issue
            a receipt, and whether it does so is a matter for that charity. We
            make no representation as to any organization's charitable status or
            its use of the funds it receives.
          </li>
          <li>
            Organizations that have not completed Stripe onboarding display an
            external donation link. Donations made through such a link take place
            outside Fetchpawz, on the terms of the receiving page, and we receive
            no information about them.
          </li>
          <li>
            We retain records of donations processed through Fetchpawz for
            financial and tax purposes, as set out in the{' '}
            <PrivacyLink>Privacy Policy</PrivacyLink>.
          </li>
        </LegalList>
        <p>
          Fraudulent donations and chargebacks are grounds for suspension.
        </p>
      </>
    ),
  },
  {
    id: 'pack-plus',
    title: 'Pack+, swipe allowances, and advertising',
    body: (
      <>
        <p>
          Accounts without Pack+ are subject to a daily swipe allowance,
          currently 50 per day and up to 150 with bonuses. These figures may
          change.
        </p>
        <p>
          Pack+ removes the daily allowance and advertising. There is no
          self-serve purchase at present. During the beta, Pack+ is granted by
          us. Should paid plans be introduced, prices and terms will be published
          before any charge is made.
        </p>
        <p>
          The application contains an advertising placeholder and a
          rewarded-video flow that is not connected to any advertising network.
          Should advertising be introduced, the{' '}
          <PrivacyLink>Privacy Policy</PrivacyLink> will be amended beforehand.
        </p>
      </>
    ),
  },
  {
    id: 'crowns',
    title: 'Crowns, badges, and rankings',
    body: (
      <p>
        Crowns, badges, and weekly rankings have no monetary value. They are not
        property, and they cannot be transferred, sold, or redeemed. Where vote
        manipulation is identified, standings may be corrected. We may reset or
        withdraw these features.
      </p>
    ),
  },
  {
    id: 'shop',
    title: 'Shop',
    body: (
      <p>
        The shop is operated through Shopify. Purchases, including payment,
        shipping, taxes, and returns, are processed through Shopify checkout and
        are governed by the terms of the store operator and of Shopify rather
        than by these terms. During the beta the shop may display a
        demonstration catalogue. Those items are not available for purchase, and
        no order will be fulfilled.
      </p>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-party services and listings',
    body: (
      <>
        <p>
          Fetchpawz relies on services we do not control, including Google and
          GitHub sign-in, Stripe, Shopify, OpenStreetMap, and the providers
          identified in the <PrivacyLink>Privacy Policy</PrivacyLink>. Your use
          of those services is governed by their terms, and we are not
          responsible for their acts or omissions.
        </p>
        <p>
          Dog park and veterinary listings are derived from OpenStreetMap
          contributor data and may be incomplete, out of date, or inaccurate.
          Listings are provided for information only and do not constitute a
          recommendation or an endorsement. Verify a clinic's credentials and
          hours before relying on them.
        </p>
      </>
    ),
  },
  {
    id: 'no-advice',
    title: 'No veterinary advice',
    body: (
      <p>
        Nothing on Fetchpawz, including veterinary listings, community posts, and
        comments, constitutes veterinary or medical advice, and none of it
        substitutes for examination by a qualified veterinarian. In an emergency,
        contact a veterinarian or an emergency animal hospital.
      </p>
    ),
  },
  {
    id: 'beta',
    title: 'Availability and changes to the service',
    body: (
      <p>
        Fetchpawz is provided as a beta service. Features may be changed,
        suspended, or withdrawn; data may be lost; and beta access may be paused
        or revoked. We may impose limits on use of the service. Where we
        discontinue the service, we will give reasonable notice and, where
        practicable, an opportunity to export your content.
      </p>
    ),
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer of warranties',
    body: (
      <p>
        The service is provided "as is" and "as available", without warranty of
        any kind, whether express or implied, including any implied warranty of
        merchantability, fitness for a particular purpose, or non-infringement.
        We do not warrant that the service will be uninterrupted, secure, or free
        from error, that alerts will be delivered, or that content posted by
        users or obtained from third-party sources is accurate. Where the law
        applicable to you does not permit the exclusion of a warranty, that
        exclusion does not apply to you.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <>
        <p>
          To the extent permitted by law, Fetchpawz is not liable for indirect,
          incidental, special, consequential, exemplary, or punitive damages, nor
          for loss of profits, loss of data, loss of goodwill, or the loss of,
          injury to, or failure to recover an animal, arising from your use of
          the service.
        </p>
        <p>
          Our aggregate liability for all claims relating to the service is
          limited to the greater of CAD $100 and the total amount paid by you to
          us in the twelve months preceding the event giving rise to the claim.
        </p>
        <p>
          Nothing in these terms limits liability for fraud or fraudulent
          misrepresentation, for death or personal injury caused by negligence,
          or for any other liability that cannot be limited under the laws of
          Alberta or of Canada, including rights conferred by Alberta consumer
          protection legislation.
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnification',
    body: (
      <p>
        You will indemnify Fetchpawz Inc. and its directors, officers, and
        employees against claims, losses, and reasonable legal costs arising from
        your content, your use of the service, your breach of these terms or of
        applicable law, or a dispute between you and another user, a rescue
        organization, or a person who finds your pet. We may assume the defence
        of any such claim, in which case you will cooperate with us.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <>
        <p>
          You may delete your account at any time within the application. The{' '}
          <PrivacyLink>Privacy Policy</PrivacyLink> explains the effect of
          deletion and how to request erasure.
        </p>
        <p>
          We may suspend or terminate an account that breaches these terms, that
          presents a risk to others, or where the law requires it. We will give
          notice where that is practicable. On termination, your licence to use
          Fetchpawz ends and your public pages are withdrawn.
        </p>
        <p>
          The following sections survive termination: Your content, to the extent
          of copies already distributed; Donations; Disclaimer of warranties;
          Limitation of liability; Indemnification; Governing law and disputes;
          and General provisions.
        </p>
      </>
    ),
  },
  {
    id: 'disputes',
    title: 'Governing law and disputes',
    body: (
      <>
        <p>
          Before commencing proceedings, write to <Mail /> describing the matter
          and the outcome you seek. We will work with you for 30 days to resolve
          it.
        </p>
        <p>
          These terms are governed by the laws of the Province of Alberta and the
          federal laws of Canada applicable in that province, without regard to
          conflict of laws principles. The courts of Alberta have jurisdiction,
          and you and we submit to that jurisdiction.
        </p>
        <p>
          These terms do not require arbitration, and they contain no waiver of
          class proceedings. Where the law applicable to you permits a claim to
          be brought in a local small claims court, or a complaint to be made to
          a consumer protection authority, these terms do not restrict that
          right.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        Where these terms change, the date at the head of this page will be
        updated. Where a change is material, we will notify account holders by
        email at least 14 days before it takes effect, where that is practicable.
        Continued use of Fetchpawz after a change takes effect constitutes
        acceptance of the amended terms. If you do not accept them, delete your
        account.
      </p>
    ),
  },
  {
    id: 'general',
    title: 'General provisions',
    body: (
      <LegalList>
        <li>
          <Term>Entire agreement.</Term> These terms and the Privacy Policy
          constitute the entire agreement between you and us concerning
          Fetchpawz.
        </li>
        <li>
          <Term>Severability.</Term> Where a provision is held unenforceable, the
          remaining provisions continue in effect.
        </li>
        <li>
          <Term>Waiver.</Term> A failure to enforce a provision is not a waiver
          of the right to enforce it subsequently.
        </li>
        <li>
          <Term>Assignment.</Term> We may assign this agreement to a successor in
          connection with a merger, an acquisition, or a sale of assets. You may
          not assign it.
        </li>
        <li>
          <Term>Force majeure.</Term> Neither party is liable for a failure to
          perform caused by circumstances beyond its reasonable control.
        </li>
        <li>
          <Term>Notices.</Term> We will contact you at the email address
          registered to your account. Notices to us should be sent to <Mail />.
        </li>
        <li>
          <Term>Language.</Term> These terms are drawn up in English, and the
          English text governs.
        </li>
        <li>
          <Term>Relationship.</Term> Nothing in these terms creates an agency,
          partnership, or employment relationship.
        </li>
      </LegalList>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      documentTitle="Terms · Fetchpawz"
      eyebrow="Terms of service"
      title="The house rules"
      lastUpdated={LAST_UPDATED}
      subtitle="The terms on which Fetchpawz is provided."
      summary={
        <>
          <p>
            You retain ownership of your photographs. We host and display them in
            order to operate the service, and we will ask before featuring your
            pet in advertising.
          </p>
          <p>
            Fetchpawz is not a party to an adoption, a pet transfer, or the use a
            rescue organization makes of a donation. Donations are
            non-refundable, and we do not issue tax receipts.
          </p>
          <p>
            Lost &amp; Found depends on reports from users and cannot be
            guaranteed. Do not send money to a person claiming to hold your pet.
          </p>
          <p>
            These terms are governed by Alberta law. They do not require
            arbitration, and they contain no waiver of class proceedings.
          </p>
        </>
      }
      summaryNote="This summary is provided for convenience and does not form part of the agreement."
      intro={
        <p>
          These terms set out the basis on which Fetchpawz is provided and what
          we ask of you in return. Please read them before creating an account.
          If any part of them is unclear, write to <Mail /> and we will explain
          it.
        </p>
      }
      sections={SECTIONS}
      footer={
        <>
          See also the <PrivacyLink>Privacy Policy</PrivacyLink>. Questions about
          these terms may be sent to <Mail />.
        </>
      }
    />
  );
}
