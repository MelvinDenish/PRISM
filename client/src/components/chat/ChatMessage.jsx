import { Link } from 'react-router-dom';
import { FiCpu } from 'react-icons/fi';

/**
 * Lightweight renderer for assistant text. The agent is instructed to use markdown
 * links to in-app routes; we render `[label](/route)` as a React Router <Link> (and
 * external http(s) links as <a target=_blank>), plus headings, paragraphs, bullet &
 * numbered lists, `**bold**`, and inline `code`. We intentionally support only this
 * safe subset (no raw HTML) — the project has no markdown dependency and this avoids
 * an XSS surface.
 */

// Inline tokens: a markdown link, **bold**, or `code`. Matched left-to-right by index.
const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

function renderInline(text, keyBase) {
  const nodes = [];
  let last = 0;
  let m;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-i${i}`;
    if (m[1] !== undefined) {
      const label = m[1];
      const href = m[2];
      if (/^https?:\/\//i.test(href)) {
        nodes.push(<a key={key} href={href} target="_blank" rel="noreferrer">{label}</a>);
      } else if (href.startsWith('/')) {
        nodes.push(<Link key={key} to={href}>{label}</Link>);
      } else {
        nodes.push(label);
      }
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<code key={key} className="chat-md-code">{m[4]}</code>);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBody(content) {
  const lines = String(content).split('\n');
  const blocks = [];
  let list = null; // { ordered: boolean, items: ReactNode[] }

  const flush = (key) => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(<Tag key={`list-${key}`} className="chat-md-list">{list.items}</Tag>);
      list = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);

    if (bullet) {
      if (!list || list.ordered) { flush(idx); list = { ordered: false, items: [] }; }
      list.items.push(<li key={`li-${idx}`}>{renderInline(bullet[1], `li-${idx}`)}</li>);
    } else if (numbered) {
      if (!list || !list.ordered) { flush(idx); list = { ordered: true, items: [] }; }
      list.items.push(<li key={`li-${idx}`}>{renderInline(numbered[1], `li-${idx}`)}</li>);
    } else {
      flush(idx);
      if (heading) {
        // #→h3, ##→h4, ###→h5 to fit the chat bubble's scale.
        const Tag = `h${heading[1].length + 2}`;
        blocks.push(<Tag key={`h-${idx}`} className="chat-md-heading">{renderInline(heading[2], `h-${idx}`)}</Tag>);
      } else if (trimmed) {
        blocks.push(<p key={`p-${idx}`}>{renderInline(trimmed, `p-${idx}`)}</p>);
      }
    }
  });
  flush('end');
  return blocks;
}

const ChatMessage = ({ role, content }) => (
  <div className={`chat-msg chat-msg--${role}`}>
    {role === 'assistant' && (
      <div className="chat-msg__avatar" aria-hidden="true"><FiCpu /></div>
    )}
    <div className="chat-msg__bubble">
      {role === 'assistant' ? renderBody(content) : <p>{content}</p>}
    </div>
  </div>
);

export default ChatMessage;
