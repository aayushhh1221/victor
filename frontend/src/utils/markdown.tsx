'use client';

import React from 'react';

/**
 * VICTOR — minimal Markdown renderer.
 *
 * The briefing endpoint emits exactly four constructs: `##` and `###`
 * headings, `- ` bullets, and `**bold**` inline spans. Rendering those four
 * directly costs ~80 lines and no bundle weight; pulling in a full Markdown
 * library to render a document we also generate would be the larger risk —
 * and the backend's own HTML report uses the same bold-splitting rule, so the
 * two renderings of a briefing stay identical.
 *
 * Anything it does not recognise is rendered as literal text rather than
 * silently dropped: a briefing is a statement about real data, so losing a
 * line of it is worse than showing stray punctuation.
 */

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

/**
 * Render `**bold**` spans. Mirrors the backend's rule exactly: split on `**`
 * and embolden the odd-indexed pieces, so an unpaired marker stays literal
 * instead of swallowing the rest of the line.
 */
function renderInline(text: string): React.ReactNode[] {
  return text.split('**').map((piece, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
        {piece}
      </strong>
    ) : (
      <React.Fragment key={i}>{piece}</React.Fragment>
    ),
  );
}

/**
 * Split a Markdown string into the block types this renderer supports.
 *
 * One non-blank line becomes one block. Adjacent lines are NOT joined into a
 * single paragraph the way a general Markdown renderer would: the briefing is
 * generated line by line, each line a separate statement, and the backend's
 * own HTML export emits one paragraph per line too — so joining them here
 * would make the inline view disagree with the exported report.
 */
export function parseMarkdownBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let items: string[] = [];

  const flushList = () => {
    if (items.length > 0) {
      blocks.push({ kind: 'ul', items });
      items = [];
    }
  };

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      flushList();
    } else if (line.startsWith('### ')) {
      flushList();
      blocks.push({ kind: 'h3', text: line.slice(4) });
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push({ kind: 'h2', text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      // Not emitted today, but treated as a top-level heading if it ever is.
      flushList();
      blocks.push({ kind: 'h2', text: line.slice(2) });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      items.push(line.slice(2));
    } else {
      flushList();
      blocks.push({ kind: 'p', text: line });
    }
  }
  flushList();
  return blocks;
}

/** Render a Markdown briefing using the design-system tokens. */
export default function Markdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseMarkdownBlocks(text), [text]);

  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      {blocks.map((block, i) => {
        if (block.kind === 'h2') {
          return (
            <h2
              key={i}
              className="text-lg font-bold mt-5 mb-2 first:mt-0 pb-1.5"
              style={{
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.kind === 'h3') {
          return (
            <h3
              key={i}
              className="text-xs font-semibold mt-4 mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {renderInline(block.text)}
            </h3>
          );
        }
        if (block.kind === 'ul') {
          return (
            <ul key={i} className="space-y-1 mb-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden style={{ color: 'var(--accent)' }}>&middot;</span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mb-2">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
