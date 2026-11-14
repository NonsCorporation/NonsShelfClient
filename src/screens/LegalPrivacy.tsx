'use client'

import LegalDocument, { type LegalSection } from '@/components/legal/LegalDocument'
import { Link } from '@/lib/router'
import { LEGAL } from '../lib/legal'

const link = 'text-nonsprimary hover:underline'

// A draft: it describes what SomeShelf does today and must be reviewed against how
// the service is actually run (providers, hosting location, retention) before it is
// relied on. English only, like the other legal texts.
function sections(): LegalSection[] {
  const { service, operator, contactEmail } = LEGAL
  return [
    {
      id: 'who',
      title: '1. Who we are',
      body: [
        <>
          {operator} (“{service}”, “we”) run {service} and decide how your personal data is used (we are the “controller”). This policy explains
          what we collect, why, who sees it and what you can do about it. It goes together with our{' '}
          <Link to="/legal/terms" className={link}>
            Terms and conditions
          </Link>
          .
        </>,
      ],
    },
    {
      id: 'collect',
      title: '2. What we collect',
      body: [
        <>
          <strong>Your account:</strong> your email address, username, name and a password hash (we never store your password itself), or, if you
          sign in with Google, the identifier Google gives us for you and the name and email on that account.
        </>,
        <>
          <strong>Your profile:</strong> what you choose to add — a photo, a banner colour, a bio, your city and country — and your privacy choices
          for each.
        </>,
        <>
          <strong>What you do in {service}:</strong> the books, films and series on your shelves and their statuses, ratings, reviews, notes,
          reading progress, collections, lists, challenges, bingo boards, comments, likes, friendships and follows, and messages you send to other
          people.
        </>,
        <>
          <strong>Payments:</strong> if you buy Horizon, we keep a billing record: your subscription’s status and dates, the amount, currency and
          tax of each charge, and the customer and order identifiers from our payment provider. We do <em>not</em> see or store your card number.
        </>,
        <>
          <strong>Technical data:</strong> your IP address and basic request details, which our servers use to keep the service running and secure
          (for example to limit abuse), and cookies described in section 6.
        </>,
      ],
    },
    {
      id: 'use',
      title: '3. How we use it, and why',
      body: [
        <>
          <strong>To run the service you asked for</strong> — your account, your shelves, your profile, social features, sign-in and email
          confirmations, and Horizon if you buy it. (Legal basis: performing our contract with you.)
        </>,
        <>
          <strong>To keep SomeShelf safe and working</strong> — preventing abuse, fixing problems, backups. (Legitimate interest.)
        </>,
        <>
          <strong>To take payments and keep records</strong> — billing, refunds, tax and accounting. (Contract and legal obligation.)
        </>,
        <>
          <strong>To contact you</strong> about your account and, where you have chosen them, notifications. (Contract, or your consent.)
        </>,
        'We don’t sell your personal data and we don’t use it for advertising.',
      ],
    },
    {
      id: 'share',
      title: '4. Who sees your data',
      body: [
        <>
          <strong>Other people</strong> see what you share, according to your settings: your name, username, photo and banner are public; your bio
          and location follow the visibility you chose (everyone, friends or only you); reviews, ratings and activity are visible as the feature and
          your privacy settings allow.
        </>,
        <>
          <strong>Service providers</strong> process data for us, only for the purpose given: hosting and network infrastructure (including a
          content delivery network), email delivery, file storage for pictures, Google for “Sign in with Google”, and{' '}
          <a href="https://polar.sh" target="_blank" rel="noopener noreferrer" className={link}>
            Polar
          </a>{' '}
          for Horizon payments. Polar is the seller of Horizon and a controller of the payment data you give it; its own privacy policy applies to that.
        </>,
        <>
          <strong>Catalog sources.</strong> To look up books and films we send search terms (not your account details) to public sources such as TMDB,
          Open Library, Google Books and Wikidata. Some features that suggest or describe works use an AI service, to which we send details of the
          work, not your personal information.
        </>,
        'We may also disclose data when the law requires it, or to protect people from harm.',
      ],
    },
    {
      id: 'transfers',
      title: '5. Where it is processed',
      body: [
        'Our providers may process data in countries other than yours, including outside the European Economic Area. Where that happens we rely on appropriate safeguards, such as standard contractual clauses or the provider’s adequacy status.',
      ],
    },
    {
      id: 'cookies',
      title: '6. Cookies and browser storage',
      body: [
        <>
          We use <strong>strictly necessary</strong> cookies only: the session cookies that keep you signed in (an access token and a refresh token) and a
          short-lived cookie while you sign in with Google. They don’t track you across sites.
        </>,
        'Your browser’s local storage keeps preferences on your device — language, theme, view settings — and, for some features, drafts. It isn’t sent to us.',
        'We don’t use advertising cookies or third-party analytics trackers.',
      ],
    },
    {
      id: 'keep',
      title: '7. How long we keep it',
      body: [
        'We keep your data while your account exists. When you delete your account, your personal details are erased or anonymized and what you posted stops being linked to you; some anonymized or shared content, such as a comment in someone else’s thread, may remain without your identity.',
        'Billing and tax records are kept for as long as the law requires, and payment-related logs for a limited time to resolve disputes and prevent fraud. Backups are overwritten on a regular cycle.',
      ],
    },
    {
      id: 'rights',
      title: '8. Your rights',
      body: [
        'Depending on where you live (for example in the EU or UK), you can ask to access your data, correct it, delete it, restrict or object to some of the ways we use it, receive a copy in a portable format, and withdraw consent you have given — without affecting what happened before.',
        <>
          Most of this is in the app: edit your profile and privacy settings, export your library, and delete your account from your settings. For
          anything else, write to us (section 11). If you aren’t happy with our answer you can complain to your local data protection authority.
        </>,
      ],
    },
    {
      id: 'security',
      title: '9. Security',
      body: [
        'We protect data with encryption in transit, hashed passwords, access controls and, for private messages, encryption at rest. No service is perfectly secure; if a breach affects your data we will tell you and the authorities as the law requires.',
      ],
    },
    {
      id: 'children',
      title: '10. Children',
      body: ['SomeShelf is not for children under 13 (or the age of digital consent in your country, if higher). If you believe a child has given us data, tell us and we will delete it.'],
    },
    {
      id: 'contact',
      title: '11. Contact, and changes to this policy',
      body: [
        contactEmail ? (
          <>
            Questions or requests about your data:{' '}
            <a href={`mailto:${contactEmail}`} className={link}>
              {contactEmail}
            </a>
            .
          </>
        ) : (
          'Questions or requests about your data: use the contact options in the app.'
        ),
        'We may update this policy. We will tell you about significant changes in advance, for example in the app or by email, and the date at the top always shows the latest version.',
      ],
    },
  ]
}

export default function LegalPrivacy() {
  return (
    <LegalDocument
      title="Privacy policy"
      summary={[
        'We collect what you give us (account, profile, shelves, reviews, messages) and a billing record if you buy Horizon.',
        'We never see your card number — payments go through Polar. We don’t sell your data or use it for ads.',
        'We use only the cookies needed to keep you signed in, and no third-party analytics trackers.',
        'You can edit, export and delete your data from the app, and write to us for anything else.',
      ]}
      sections={sections()}
    />
  )
}
