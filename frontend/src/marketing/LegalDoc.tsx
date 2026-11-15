import type { ReactNode } from 'react';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import PageHero from './PageHero';

export interface LegalSectionSpec {
  /** Anchor slug — `/privacy#retention` must keep working once published. */
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Shared shell for the Privacy Policy and Terms of Service.
 *
 * The table of contents is derived from the same `sections` array that renders
 * the document, so a new section can never be missing from the nav — the
 * failure mode of every hand-maintained legal ToC.
 *
 * Legal pages stay quiet: the quiet hero, Bagel only for the page title, and
 * Figtree everywhere else.
 */
export default function LegalDoc({
  documentTitle,
  eyebrow,
  title,
  lastUpdated,
  subtitle,
  summary,
  summaryNote,
  intro,
  sections,
  footer,
}: {
  documentTitle: string;
  eyebrow: string;
  title: string;
  lastUpdated: string;
  subtitle: string;
  /** Plain-language overview shown above the operative text. */
  summary: ReactNode;
  /** Disclaimer identifying the summary as non-operative. */
  summaryNote: string;
  intro: ReactNode;
  sections: LegalSectionSpec[];
  footer: ReactNode;
}) {
  useDocumentTitle(documentTitle);

  return (
    <div className="animate-fade-in">
      <PageHero
        eyebrow={eyebrow}
        title={title}
        subtitle={`${subtitle} Last updated ${lastUpdated}.`}
        tone="quiet"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="On this page" className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <p className="eyebrow">On this page</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="font-semibold text-gray-600 dark:text-gray-300 hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 space-y-10 text-base leading-relaxed text-gray-700 dark:text-gray-300">
            <div className="rounded-2xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 p-5 sm:p-6">
              <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-brand-700 dark:text-brand-400">
                Summary
              </p>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 space-y-2">{summary}</div>
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">{summaryNote}</p>
            </div>

            <section>{intro}</section>

            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl font-extrabold text-navy dark:text-biscuit">
                  {s.title}
                </h2>
                <div className="mt-3 space-y-3">{s.body}</div>
              </section>
            ))}

            <section className="surface p-6 text-center">
              <p className="text-sm">{footer}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bulleted list with the spacing both legal pages use. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2">{children}</ul>;
}

/** Inline emphasis for a defined term or the lead-in of a list item. */
export function Term({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-navy dark:text-biscuit">{children}</strong>;
}

/** Two-column reference table (retention periods, processor list). */
export function LegalTable({
  caption,
  head,
  rows,
}: {
  caption?: string;
  head: [string, string];
  rows: Array<[ReactNode, ReactNode]>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-night-surface">
      <table className="w-full text-sm text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-gray-100 dark:bg-night-raised text-navy dark:text-biscuit">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-extrabold">{head[0]}</th>
            <th scope="col" className="px-4 py-2.5 font-extrabold">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              <th scope="row" className="px-4 py-2.5 font-bold text-navy dark:text-biscuit">
                {row[0]}
              </th>
              <td className="px-4 py-2.5">{row[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
