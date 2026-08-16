import { Link } from 'react-router-dom';
import LegalDoc, { LegalList, Term } from './LegalDoc';
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
    id: 'agreement',
    title: 'The agreement',
    body: (
      <>
        <p>
          These Terms are an agreement between you and Fetchpawz Inc.
          ("Fetchpawz", "we", "us"), a company based in Alberta, Canada. By
          creating an account or using Fetchpawz, you agree to them. If you
          don't agree, don't use the service.
        </p>
        <p>
          Our <PrivacyLink>Privacy Policy</PrivacyLink> is part of this
          agreement. If you're agreeing on behalf of an organization — a rescue,
          for instance — you're confirming you have the authority to bind it.
        </p>
        <p>
          Fetchpawz is an invite-only beta, so expect things to change while we
          build.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use Fetchpawz',
    body: (
      <>
        <p>
          You need to be at least 13. If you're between 13 and 17, a parent or
          guardian needs to read these Terms and agree to them on your behalf.
        </p>
        <p>
          One account per person. Rescues use an organization account, which we
          approve by hand. You can't use Fetchpawz if we've previously
          terminated your account, or if the law where you are prohibits it.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <p>
        Give us accurate information and keep it current. Keep your password to
        yourself — two-factor authentication is available on every account and
        we recommend turning it on. You're responsible for what happens under
        your account, so tell us at <Mail /> right away if you think someone
        else has access to it. Don't sell, share, or transfer your account.
      </p>
    ),
  },
  {
    id: 'license',
    title: 'Your licence to use Fetchpawz',
    body: (
      <>
        <p>
          We give you a personal, limited, non-exclusive, non-transferable,
          revocable licence to use Fetchpawz for what it's for: showing off your
          pets and taking part in the community.
        </p>
        <p>
          Everything that isn't your content — the app, the site, the name, the
          logo, the design — belongs to us. Don't copy it, reverse engineer it,
          resell access to it, or strip out our notices.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content, and what you let us do with it',
    body: (
      <>
        <p>
          <Term>Your photos and words stay yours.</Term> We don't claim
          ownership of anything you post.
        </p>
        <p>
          To run the service, you give us a worldwide, non-exclusive,
          royalty-free licence to host, store, copy, resize, re-encode, and
          display your content — and to pass it to the providers who help us do
          that, like our hosting and photo-moderation services. That's what
          makes a feed a feed. The licence exists for that purpose and no other.
        </p>
        <p>
          <Term>We will ask you first</Term> before featuring your pet in an
          advertisement or on our marketing site. Posting a photo here is not
          consent to become our billboard.
        </p>
        <p>
          <Term>We don't sell your photos, and we don't license them for
          training AI models.</Term>
        </p>
        <p>
          The licence ends when you delete the content or your account — with
          the practical exceptions that copies other people already shared or
          saved are out of our hands, search engines take time to drop cached
          pages, and content sits in our backups until they age out. Our{' '}
          <PrivacyLink>Privacy Policy</PrivacyLink> covers the timing.
        </p>
        <p>When you post, you're confirming that:</p>
        <LegalList>
          <li>you own the content or have permission to post it;</li>
          <li>
            the pet is yours — or, for a rescue account, one your organization
            is authorized to list;
          </li>
          <li>
            it doesn't include another person's private information, or a
            recognizable photo of someone else's child, without their consent.
          </li>
        </LegalList>
        <p>
          If you send us feedback or a feature idea, we can use it freely,
          without owing you anything for it. Please don't send us anything
          confidential.
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'House rules',
    body: (
      <>
        <p>Be the person your pet thinks you are. Specifically, don't:</p>
        <LegalList>
          <li>
            harass, threaten, or dox anyone, or post content that's hateful,
            sexual, violent, or illegal;
          </li>
          <li>
            impersonate another person, a rescue, a veterinarian, or Fetchpawz
            staff;
          </li>
          <li>
            file false lost-pet reports, fake sightings, or bogus "I found your
            pet" claims;
          </li>
          <li>
            post content depicting animal cruelty or animal fighting, or use
            Fetchpawz to sell or breed animals commercially;
          </li>
          <li>
            manipulate votes, rankings, or crowns — no second accounts, no bots,
            no vote rings;
          </li>
          <li>
            scrape, crawl, or bulk-download the service beyond what our
            robots.txt allows, or use Fetchpawz content to train machine
            learning models;
          </li>
          <li>
            work around rate limits, invite gating, swipe allowances, or any
            other technical restriction;
          </li>
          <li>
            probe or test the security of the service without our written
            permission — if you find something, email <Mail /> and we'll thank
            you properly;
          </li>
          <li>
            claim a QR collar tag for a pet that isn't yours, or use a contact
            relay for anything other than a genuine message about that pet;
          </li>
          <li>spam people or resell the service.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: 'moderation',
    title: 'Moderation and enforcement',
    body: (
      <>
        <p>
          Photos are screened automatically before they appear publicly, and
          anything flagged is held for a person to review. We may review
          reported content, but we're not obliged to monitor everything, and we
          don't endorse what members post.
        </p>
        <p>
          We can remove content, limit features, and suspend or terminate
          accounts that break these rules — without notice where there's a risk
          of harm. Repeat violations end in termination.
        </p>
        <p>
          <Term>If we get it wrong, email <Mail /> and a person will look at
          it.</Term> That's a real commitment, not a formality.
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
          If you believe something on Fetchpawz infringes your copyright, email{' '}
          <Mail /> with:
        </p>
        <LegalList>
          <li>the work you say is infringed;</li>
          <li>the URL of the content on Fetchpawz;</li>
          <li>your name and contact details;</li>
          <li>
            a statement that you believe in good faith the use isn't authorized;
          </li>
          <li>
            a statement that your notice is accurate and that you're the owner or
            authorized to act for them.
          </li>
        </LegalList>
        <p>
          Under Canada's notice-and-notice regime we forward complete notices to
          the member who posted the content. Separately, and as a matter of our
          own policy, we remove content we determine to be infringing and tell
          the poster, who can respond. <Term>Accounts that repeatedly infringe
          are terminated.</Term>
        </p>
        <p>
          Don't send a bad-faith notice. Misrepresenting a copyright claim can
          make you liable for the resulting damage.
        </p>
      </>
    ),
  },
  {
    id: 'public',
    title: 'Public pages, sharing, and QR tags',
    body: (
      <>
        <p>
          Pet share pages are public unless you turn them off, and open lost-pet
          reports you mark public can be indexed by search engines. The{' '}
          <PrivacyLink>Privacy Policy</PrivacyLink> spells out exactly which
          pages those are.
        </p>
        <p>
          Once something is public, other people can copy it. We can remove a
          page from Fetchpawz; we can't remove it from the internet. Decide
          accordingly before you make a pet public.
        </p>
        <p>
          A QR collar tag is a way for a stranger holding your pet to reach you.
          Claim tags only for your own pets. We're not responsible for what a
          finder does, and we don't verify who scans a tag.
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
          Lost &amp; Found runs on community reports. <Term>We can't guarantee
          that a sighting is accurate, that an alert reaches anyone, or that a
          lost pet is found.</Term> Fetchpawz should never be your only
          channel — call your local shelters, veterinary clinics, and municipal
          animal services too.
        </p>
        <p>
          Locations shown to other people are deliberately offset. Don't try to
          defeat that, and don't publish someone else's exact location.
        </p>
        <p className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 p-4 text-gray-700 dark:text-gray-300">
          <Term>Please read this part.</Term> We don't verify anyone's identity.
          Pet-recovery scams are common and they target people at their most
          desperate. <Term>Never send money to someone claiming to have your
          pet.</Term> Meet in a public place, in daylight, and bring someone
          with you. Ask for a photo showing something only the real finder could
          know.
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
          Rescue accounts are reviewed and approved by hand before they can list
          pets. Keep listings accurate, mark pets adopted promptly, and treat
          adopter inquiries with care. We can revoke approval if an account is
          misused.
        </p>
        <p>
          <Term>Fetchpawz is not a party to any adoption.</Term> We don't screen
          adopters, we don't verify a rescue's registration or charitable status
          beyond a basic review, we don't guarantee an animal's health,
          temperament, or history, and we don't handle adoption fees. The
          adoption agreement is between you and the rescue. Do your own
          diligence on both sides.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'Pet transfers',
    body: (
      <p>
        Transferring a pet moves the <Term>profile</Term> from one Fetchpawz
        account to another. It has no legal effect on who owns the animal. It is
        not a bill of sale, an adoption contract, or proof of ownership, and it
        shouldn't be treated as one in a dispute. The real-world arrangement is
        between the two people involved.
      </p>
    ),
  },
  {
    id: 'donations',
    title: 'Donations',
    body: (
      <>
        <p>
          You can donate to Fetchpawz, or to a participating rescue, through
          Stripe Checkout inside the app. Card details go directly to Stripe and
          never reach us.
        </p>
        <LegalList>
          <li>
            <Term>Rescue donations run through Stripe Connect.</Term> Stripe
            processes the payment and settles the funds into the rescue's own
            Stripe account. <Term>We may keep a platform fee</Term> to cover
            our costs; where we do, it's disclosed before you pay.
          </li>
          <li>
            <Term>Donations are final and non-refundable</Term>, except where
            the law says otherwise or we agree otherwise. A refund on a rescue
            donation is that rescue's decision, made through Stripe.
          </li>
          <li>
            <Term>Donations made through Fetchpawz are not tax-deductible
            through us, and we do not issue tax receipts.</Term> Only a
            registered charity can issue one, and whether it does is up to
            them. We make no representation about any rescue's charitable
            status or how it spends what it receives.
          </li>
          <li>
            Rescues that haven't onboarded with Stripe show an external donation
            link instead. Those donations happen entirely off Fetchpawz, under
            whatever terms that page sets, and we see nothing about them.
          </li>
          <li>
            We keep a record of donations made through us for financial and tax
            purposes, as described in the{' '}
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
    title: 'Pack+, swipes, and ads',
    body: (
      <>
        <p>
          Free accounts get a daily swipe allowance — currently 50 a day, and up
          to 150 with bonuses. We can change those numbers as we tune the
          service.
        </p>
        <p>
          Pack+ removes the daily cap and the ads. <Term>There is no self-serve
          purchase today</Term>: during beta, Pack+ is granted by us. If we
          introduce paid plans, we'll publish the prices and the terms before
          charging anyone, and nobody gets billed for something they didn't
          knowingly buy.
        </p>
        <p>
          The app contains an ad placeholder and a rewarded-video flow that
          isn't connected to any ad network yet. If we turn on real ads, we'll
          update the <PrivacyLink>Privacy Policy</PrivacyLink> first.
        </p>
      </>
    ),
  },
  {
    id: 'crowns',
    title: 'Crowns, badges, and rankings',
    body: (
      <p>
        Crowns, badges, and weekly rankings are for fun. They have no monetary
        value, they aren't property, and they can't be transferred, sold, or
        redeemed for anything. If we find vote manipulation we'll correct the
        standings, and we can reset or retire any of it.
      </p>
    ),
  },
  {
    id: 'shop',
    title: 'Shop',
    body: (
      <p>
        The shop is powered by Shopify. Purchases — payment, shipping, taxes,
        returns — run through Shopify checkout under the store's and Shopify's
        terms, not ours. While Fetchpawz is in beta the shop may show a demo
        catalogue: those aren't real products and no order will be fulfilled.
      </p>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-party services and listings',
    body: (
      <>
        <p>
          Fetchpawz uses services we don't control: Google and GitHub sign-in,
          Stripe, Shopify, OpenStreetMap, and the providers listed in our{' '}
          <PrivacyLink>Privacy Policy</PrivacyLink>. Their terms apply to your
          use of them, and we're not responsible for what they do.
        </p>
        <p>
          Dog park and veterinary listings come from OpenStreetMap contributors
          and may be incomplete, out of date, or wrong. Listings are
          information, not endorsements or recommendations. Verify a clinic's
          credentials and hours yourself before you rely on them.
        </p>
      </>
    ),
  },
  {
    id: 'no-advice',
    title: 'Not veterinary advice',
    body: (
      <p>
        Nothing on Fetchpawz — vet listings, community posts, comments, or
        anything else — is veterinary or medical advice, and none of it
        substitutes for an actual veterinarian who has examined your animal.{' '}
        <Term>In an emergency, call a vet or an emergency animal hospital.</Term>
      </p>
    ),
  },
  {
    id: 'beta',
    title: 'Beta, and changes to the service',
    body: (
      <p>
        Fetchpawz is in beta. Features may change, break, or be removed; data
        may occasionally be lost; and we may pause or revoke beta access as we
        test. We can also set or change limits on how the service is used. If we
        ever discontinue Fetchpawz, we'll give reasonable notice and a chance to
        get your content out where we practically can.
      </p>
    ),
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer of warranties',
    body: (
      <p>
        Fetchpawz is provided <Term>"as is" and "as available"</Term>, without
        warranties of any kind, express or implied — including implied
        warranties of merchantability, fitness for a particular purpose, and
        non-infringement. We don't warrant that the service will be
        uninterrupted, secure, or error-free, that alerts will be delivered, or
        that content posted by members or imported from third parties is
        accurate. Some jurisdictions don't allow these exclusions; to that
        extent, they don't apply to you.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <>
        <p>
          To the fullest extent the law allows, Fetchpawz is not liable for
          indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for lost profits, lost data, or lost goodwill — including{' '}
          <Term>loss of, injury to, or failure to recover an animal</Term> —
          arising out of your use of the service.
        </p>
        <p>
          Our total liability for all claims relating to the service is capped
          at the greater of <Term>CAD $100</Term> or the total amount you paid
          us in the twelve months before the claim arose.
        </p>
        <p>
          Nothing here limits liability for fraud or fraudulent
          misrepresentation, for death or personal injury caused by negligence,
          or for anything else that can't be limited under Alberta or Canadian
          law — including rights you have under Alberta's consumer protection
          legislation.
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnification',
    body: (
      <p>
        You agree to indemnify Fetchpawz Inc. and its directors, officers, and
        employees against claims, losses, and reasonable legal costs arising out
        of your content, your use of the service, your breach of these Terms or
        of the law, or a dispute between you and another member, a rescue, or a
        finder. We may take over the defence of any such claim, and you'll
        cooperate with us if we do.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <>
        <p>
          You can delete your account at any time from inside the app. Read{' '}
          <PrivacyLink>what deletion actually does today</PrivacyLink> — it
          deactivates rather than erases, and erasure is an email away.
        </p>
        <p>
          We can suspend or terminate an account that breaks these Terms, poses
          a risk to others, or where the law requires it, and we'll give notice
          where that's practical. On termination your licence to use Fetchpawz
          ends and your public pages come down.
        </p>
        <p>
          These sections survive termination: Your content (for copies already
          shared), Donations, Disclaimer of warranties, Limitation of liability,
          Indemnification, Disputes and governing law, and General.
        </p>
      </>
    ),
  },
  {
    id: 'disputes',
    title: 'Disputes and governing law',
    body: (
      <>
        <p>
          <Term>Talk to us first.</Term> Email <Mail /> describing the problem
          and what you'd like done about it. We'll work with you for 30 days to
          sort it out. Nearly everything ends here.
        </p>
        <p>
          These Terms are governed by the laws of the{' '}
          <Term>Province of Alberta</Term> and the federal laws of Canada that
          apply there, without regard to conflict-of-laws rules. Disputes go to
          the courts of Alberta, and you and we consent to their jurisdiction.
        </p>
        <p>
          <Term>We don't ask you to give up your right to go to court.</Term>{' '}
          There's no forced arbitration here and no class-action waiver. If the
          law where you live lets you bring a claim in your local small claims
          court or take a complaint to a consumer protection authority, this
          agreement doesn't take that away.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <p>
        When we change these Terms we'll update the date at the top, and for
        anything significant we'll email account holders — at least 14 days
        before the change takes effect, where that's practical. Using Fetchpawz
        after a change means you accept the new Terms. If you don't accept them,
        delete your account.
      </p>
    ),
  },
  {
    id: 'general',
    title: 'General',
    body: (
      <LegalList>
        <li>
          <Term>Entire agreement.</Term> These Terms and the Privacy Policy are
          the whole agreement between us about Fetchpawz.
        </li>
        <li>
          <Term>Severability.</Term> If a court finds part of this unenforceable,
          the rest still stands.
        </li>
        <li>
          <Term>No waiver.</Term> If we don't enforce something right away, we
          haven't given up the right to enforce it later.
        </li>
        <li>
          <Term>Assignment.</Term> We can transfer this agreement to a successor
          if the company is sold or merged; you can't transfer it.
        </li>
        <li>
          <Term>Force majeure.</Term> Neither of us is liable for failures caused
          by things genuinely outside our control.
        </li>
        <li>
          <Term>Notices.</Term> We'll reach you at the email address on your
          account. Reach us at <Mail />.
        </li>
        <li>
          <Term>Language.</Term> These Terms are written in English, and the
          English version governs.
        </li>
        <li>
          <Term>No partnership.</Term> Nothing here makes either of us the other's
          agent, partner, or employee.
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
      subtitle="The deal between you and Fetchpawz, in plain English."
      summary={
        <>
          <p>
            Your photos stay yours. We host and display them to run the app, and
            we'll ask before putting your pet in an ad.
          </p>
          <p>
            Fetchpawz isn't a party to adoptions, pet transfers, or what a rescue
            does with a donation — and donations through us are non-refundable
            and come with no tax receipt.
          </p>
          <p>
            Lost &amp; Found is community-reported and can't be guaranteed. Never
            send money to someone claiming to have your pet.
          </p>
          <p>
            Alberta law governs. No forced arbitration, no class-action waiver.
          </p>
        </>
      }
      intro={
        <p>
          These are the house rules for Fetchpawz — what you can expect from us,
          and what we expect from you. We've kept them readable on purpose. If
          something here doesn't make sense, email <Mail /> and ask; that's a
          better outcome for both of us than you agreeing to something you
          didn't follow.
        </p>
      }
      sections={SECTIONS}
      footer={
        <>
          See also the <PrivacyLink>Privacy Policy</PrivacyLink>, or write to{' '}
          <Mail />.
        </>
      }
    />
  );
}
