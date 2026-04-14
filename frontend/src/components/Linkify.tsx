import { Fragment } from 'react';

// Match bare URLs (http/https) and www.* starts. Trailing punctuation is
// intentionally excluded so "see example.com." doesn't swallow the period.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()"']+[^\s<>()"'.,!?;:]/gi;

interface LinkifyProps {
  children: string | null | undefined;
  className?: string;
}

/**
 * Renders text with bare URLs converted to anchor tags. URLs that start with
 * "www." get an `https://` prefix for the href while preserving display text.
 */
export default function Linkify({ children, className }: LinkifyProps) {
  if (!children) return null;
  const parts: Array<string | { url: string; display: string }> = [];
  let lastIndex = 0;
  for (const match of children.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(children.slice(lastIndex, start));
    const display = match[0];
    const url = display.startsWith('www.') ? `https://${display}` : display;
    parts.push({ url, display });
    lastIndex = start + display.length;
  }
  if (lastIndex < children.length) parts.push(children.slice(lastIndex));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-500 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part.display}
          </a>
        ),
      )}
    </span>
  );
}
