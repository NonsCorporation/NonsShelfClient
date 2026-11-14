'use client'

import Layout from '../components/layout/Layout'
import { Link } from '@/lib/router'
import { LEGAL } from '../lib/legal'

type Section = { id: string; title: string; body: React.ReactNode[] }

const p = (text: React.ReactNode) => text

// The terms are written in English only: they are a legal text, and a machine
// translation of one is worse than none.
function sections(): Section[] {
  const { service, operator, graceDays, horizonPrice, governingLaw, contactEmail } = LEGAL
  return [
    {
      id: 'about',
      title: '1. About these terms',
      body: [
        p(
          <>
            These terms are the agreement between you and {operator} (“{service}”, “we”, “us”) about your use of the {service} website
            and apps. By creating an account or using {service} you accept them. If you don’t, please don’t use it.
          </>,
        ),
        p('You must be at least 13 years old, or the age at which you can consent to an online service in your country if that is higher.'),
      ],
    },
    {
      id: 'service',
      title: '2. What SomeShelf is',
      body: [
        p(
          'SomeShelf is a place to keep track of the books, films and series you read and watch, to rate and review them, to share lists and take part in challenges with other people.',
        ),
        p(
          'We keep improving it, and features change. We try not to remove things people rely on without warning, but we can change, add or retire features.',
        ),
      ],
    },
    {
      id: 'account',
      title: '3. Your account',
      body: [
        p('Keep your login details to yourself and tell us if you think someone else is using your account. You are responsible for what happens under it.'),
        p('Give us accurate information. One person, one account; you can delete yours at any time from your settings.'),
      ],
    },
    {
      id: 'content',
      title: '4. Your content and how you behave',
      body: [
        p(
          'What you write — reviews, comments, lists, bingo boards, your profile — stays yours. You give us the permission we need to store it, show it to the people you chose to share it with, and display it inside SomeShelf (including previews and share images). That permission ends when you delete the content or your account, except for copies that other people have legitimately quoted or shared and short-lived backups.',
        ),
        p('Don’t post anything unlawful, hateful, harassing or misleading; don’t impersonate people; don’t upload content you have no right to; don’t spam, scrape the service at scale or try to break or overload it.'),
        p('We may remove content or restrict accounts that break these rules, and we may do so without notice where it is needed to protect people or the service.'),
      ],
    },
    {
      id: 'catalog',
      title: '5. Catalog and third-party material',
      body: [
        p(
          'Book and film information, covers and posters come from third-party sources and from the community, and belong to their respective owners. They are shown to describe the works, not as ours. We don’t guarantee that catalog information is complete or correct.',
        ),
      ],
    },
    {
      id: 'horizon',
      title: '6. Horizon',
      body: [
        p(
          <>
            Horizon is an optional paid membership. It adds extras to your profile — currently the Horizon icon next to your name and the
            ability to use an image as your banner — and more may be added over time. Everything else in {service} stays free.
          </>,
        ),
        p('We may add, change or retire Horizon features. If we remove a feature that you are paying for, we will tell you and you can cancel and be refunded the unused part of the current period.'),
      ],
    },
    {
      id: 'payments',
      title: '7. Payments and billing',
      body: [
        p(
          <>
            <strong>Price.</strong> Horizon costs {horizonPrice}. The price shown at checkout is the price you pay; where the law requires it, it
            already includes VAT or sales tax. Prices are shown in US dollars; your bank may convert them and charge its own fees.
          </>,
        ),
        p(
          <>
            <strong>Who sells it.</strong> Payments are handled by our payment provider,{' '}
            <a href="https://polar.sh" target="_blank" rel="noopener noreferrer" className="text-nonsprimary hover:underline">
              Polar
            </a>
            , which acts as the <em>merchant of record</em>: it is the seller of Horizon to you, charges your card, collects and pays the applicable
            taxes, issues receipts and handles refunds and payment disputes. Your payment details go to Polar and its payment processors; we never
            see or store your card number. Polar’s own terms and privacy policy apply to the payment.
          </>,
        ),
        p(
          <>
            <strong>Subscription and renewal.</strong> Horizon is a subscription. You are charged when you join and then again at the start of each
            monthly period, automatically, with the same card, until you cancel. We (through Polar) may send a reminder before a renewal.
          </>,
        ),
        p(
          <>
            <strong>Price changes.</strong> If we change the price, we will tell you in advance, and the new price applies from your next renewal
            after that notice. If you don’t agree, cancel before it.
          </>,
        ),
        p(
          <>
            <strong>Failed payments.</strong> If a renewal fails, Polar will retry it. We keep your Horizon on for up to {graceDays} days after the
            end of a paid period while it does. If the payment still can’t be collected, the subscription ends and Horizon stops.
          </>,
        ),
        p(
          <>
            <strong>Your billing record.</strong> The Horizon page shows your subscription, its renewal or end date and your payment history. Receipts
            and invoices are sent by Polar to the email on your subscription.
          </>,
        ),
      ],
    },
    {
      id: 'cancel',
      title: '8. Cancelling',
      body: [
        p(
          'You can cancel at any time from the Horizon page (“Manage subscription”), which opens Polar’s customer portal where you can also change your card and download invoices. Cancelling stops future renewals; Horizon stays active until the end of the period you have already paid for. We don’t refund the unused part of a period you chose to cancel, except as described below or where the law says otherwise.',
        ),
      ],
    },
    {
      id: 'refunds',
      title: '9. Refunds and your right to withdraw',
      body: [
        p(
          <>
            <strong>If you are a consumer in the European Union or the UK,</strong> you have the right to withdraw from a distance contract within
            14 days of buying it, without giving a reason. Horizon is a digital service that starts immediately. By subscribing and asking for it to
            start at once you agree that, if you withdraw within the 14 days, we keep an amount proportionate to what you have already used, and the
            rest is refunded; once the service has been fully provided you can no longer withdraw. To withdraw, write to us or contact Polar
            support.
          </>,
        ),
        p('Whatever your location, if something went wrong — a charge you didn’t expect, a double charge, a feature that doesn’t work — write to us within 30 days of the charge and we will make it right, which can include a refund.'),
        p('A refund of a payment ends the Horizon access it paid for. Refunds are made to the original payment method by Polar and can take several days to show up.'),
      ],
    },
    {
      id: 'taxes',
      title: '10. Taxes',
      body: [p('Polar, as the seller, calculates, collects and remits VAT and sales taxes where required. Any tax is shown on your receipt.')],
    },
    {
      id: 'chargebacks',
      title: '11. Disputes with your bank and misuse',
      body: [
        p('Please contact us before disputing a charge with your bank; we resolve most things within a day or two. A payment dispute or chargeback, or evidence that a payment was fraudulent, may end the Horizon access it paid for and can lead to the account being restricted.'),
      ],
    },
    {
      id: 'termination',
      title: '12. Suspension and ending your account',
      body: [
        p('You can stop using SomeShelf and delete your account at any time. Deleting your account does not by itself cancel a Horizon subscription — cancel it first (section 8), or you will keep being charged.'),
        p('We may suspend or close accounts that seriously or repeatedly break these terms. If we close a paying account for a reason other than your breach, we refund the unused part of the current period.'),
      ],
    },
    {
      id: 'liability',
      title: '13. Warranties and liability',
      body: [
        p('SomeShelf is provided “as is”. We work to keep it available and your data safe, but we can’t promise it will always be error-free or uninterrupted.'),
        p('To the extent the law allows, we are not liable for indirect or consequential losses, or for losses that were not foreseeable when you started using the service, and our total liability to you for anything related to the service is limited to the amount you paid us in the 12 months before the claim (or, if you paid nothing, to a nominal sum). Nothing here limits liability that cannot be limited by law, or any mandatory consumer rights you have where you live.'),
      ],
    },
    {
      id: 'changes',
      title: '14. Changes to these terms',
      body: [
        p('We may update these terms. For significant changes — especially to payments — we will tell you in advance (for example in the app or by email). If you keep using SomeShelf after a change takes effect you accept it; if you don’t agree, you can cancel and delete your account.'),
      ],
    },
    {
      id: 'law',
      title: '15. Governing law',
      body: [
        p(
          <>
            These terms are governed by the law of {governingLaw}. If you are a consumer, you also keep the protection of the mandatory consumer
            rules of the country where you live, and you may bring a claim in the courts of that country.
          </>,
        ),
      ],
    },
    {
      id: 'contact',
      title: '16. Contact',
      body: [
        p(
          contactEmail ? (
            <>
              Questions about these terms, billing or refunds:{' '}
              <a href={`mailto:${contactEmail}`} className="text-nonsprimary hover:underline">
                {contactEmail}
              </a>
              .
            </>
          ) : (
            'Questions about these terms, billing or refunds: use the contact options in the app.'
          ),
        ),
      ],
    },
  ]
}

export default function LegalTerms() {
  const list = sections()
  const updated = new Date(LEGAL.updated).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <nav className="mb-4 text-xs text-[var(--text-muted)]" aria-label="Breadcrumb">
          <Link to="/legal" className="hover:text-[var(--text)] hover:underline">
            Legal
          </Link>{' '}
          / <span className="text-[var(--text)]">Terms and conditions</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Terms and conditions</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Last updated {updated}</p>

        <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">In short</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--text)]">
            <li>SomeShelf is free. Horizon is an optional subscription, {LEGAL.horizonPrice}, that renews automatically.</li>
            <li>Payments are handled by Polar, who sells Horizon to you and deals with taxes, receipts and refunds.</li>
            <li>Cancel any time from the Horizon page; you keep Horizon until the end of the period you paid for.</li>
            <li>EU and UK consumers can withdraw within 14 days. Anything that went wrong with a charge, tell us and we’ll fix it.</li>
          </ul>
        </div>

        <nav aria-label="Contents" className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {list.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-[var(--text-muted)] hover:text-nonsprimary hover:underline">
              {s.title.replace(/^\d+\.\s*/, '')}
            </a>
          ))}
        </nav>

        <div className="mt-8 space-y-8">
          {list.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-base font-semibold text-[var(--text)]">{s.title}</h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--text)]">
                {s.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  )
}
