import { useState, useRef, useEffect, useCallback } from 'react';
import { FiSend, FiCpu, FiPlus, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import {
  sendAssistantMessage,
  listConversations,
  getConversation,
  deleteConversation,
} from '../services/api';
import ChatMessage from '../components/chat/ChatMessage';
import ProposalCard from '../components/chat/ProposalCard';
import ArtifactCard from '../components/chat/ArtifactCard';
import './Assistant.css';

// Role-aware starter prompts (chat-first front door to the platform).
const SUGGESTIONS = {
  mentee: [
    'Give me a roadmap to crack Amazon',
    'Find me a mentor who works at a top company',
    'How am I doing on my prep so far?',
    'Where do I practice coding problems?',
  ],
  mentor: [
    'Show me my upcoming sessions',
    'What topics and resources are on the platform?',
  ],
  admin: [
    'List the companies on the platform',
    'What topics exist?',
  ],
};

/** Format a date relative to now (today / yesterday / N days ago / date). */
function relativeDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Assistant = () => {
  const { user, refreshUser } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = user?.greeting || `Hi ${firstName}, I'm PRISM Copilot`;

  // Conversation list (sidebar rail).
  const [convList, setConvList] = useState([]);
  const [convListLoading, setConvListLoading] = useState(true);

  // Active conversation state.
  const [activeConvId, setActiveConvId] = useState(null);
  // messages: { role: 'user'|'assistant', content, proposedActions? }
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sidebar visibility toggle (mobile).
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef(null);
  // Ref always mirrors activeConvId so async callbacks can detect a mid-flight
  // conversation switch without stale closure values.
  const activeConvIdRef = useRef(activeConvId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  const suggestions = SUGGESTIONS[user?.role] || SUGGESTIONS.mentee;

  // Auto-scroll to bottom when messages or loading state changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Load conversation list on mount.
  const loadConvList = useCallback(async () => {
    try {
      setConvListLoading(true);
      const { data } = await listConversations();
      setConvList(data.conversations || []);
    } catch {
      // Non-fatal — list just stays empty.
    } finally {
      setConvListLoading(false);
    }
  }, []);

  useEffect(() => { loadConvList(); }, [loadConvList]);

  // Select a past conversation — hydrate its messages from the server.
  const selectConversation = useCallback(async (id) => {
    if (id === activeConvId) { setSidebarOpen(false); return; }
    setError('');
    try {
      const { data } = await getConversation(id);
      const conv = data.conversation;
      setActiveConvId(conv._id);
      // Map DB messages → UI shape (include proposedActions for ProposalCards).
      setMessages(
        (conv.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          proposedActions: m.proposedActions || [],
          artifacts: (m.artifacts || []).filter((a) => a && a.kind === 'artifact'),
        }))
      );
    } catch {
      setError('Could not load conversation.');
    } finally {
      setSidebarOpen(false);
    }
  }, [activeConvId]);

  // Start a fresh conversation (clear active state).
  const newChat = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setInput('');
    setError('');
    setSidebarOpen(false);
  }, []);

  // Delete a conversation from the list (and clear active if it's the current one).
  const handleDelete = useCallback(async (e, id) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConvList((prev) => prev.filter((c) => c._id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {
      // Ignore — the item stays in the list.
    }
  }, [activeConvId]);

  // Send a message (persistent path).
  const send = useCallback(async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    // Capture the conversation id at call time so we can detect a mid-flight switch.
    const capturedId = activeConvId;

    setMessages((prev) => [...prev, { role: 'user', content }]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const { data } = await sendAssistantMessage({ conversationId: capturedId, message: content });

      const returnedId = data.conversationId;
      // Determine whether the user switched conversations while the request was in flight.
      // New-chat case: capturedId is null; user "stays" if the ref is still null (no selection).
      // Existing-chat case: user stays if the ref still points to the same id.
      const userStayed =
        capturedId === null
          ? activeConvIdRef.current === null
          : activeConvIdRef.current === capturedId;

      if (userStayed) {
        // Safe to apply the reply to the currently visible conversation.
        setActiveConvId(returnedId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply || '',
            proposedActions: data.proposedActions || [],
          },
        ]);
      }
      // If the user switched away we silently discard the reply (it's already persisted
      // server-side and will reappear when they reload that conversation).

      // Always refresh sidebar list so the new/bumped conversation appears.
      setConvList((prev) => {
        const exists = prev.find((c) => c._id === returnedId);
        if (exists) {
          // Bump updatedAt to top.
          return [
            { ...exists, updatedAt: new Date().toISOString() },
            ...prev.filter((c) => c._id !== returnedId),
          ];
        }
        // New conversation — full list refresh will add it with its real title.
        return prev;
      });

      // Reload list fully on first message of a brand-new conversation so the title appears.
      if (!capturedId && returnedId) {
        loadConvList();
      }
    } catch (err) {
      // Only surface the error if the user is still looking at the same conversation.
      const userStillHere =
        capturedId === null
          ? activeConvIdRef.current === null
          : activeConvIdRef.current === capturedId;
      if (userStillHere) {
        setError(err.response?.data?.message || 'The assistant is unavailable right now.');
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeConvId, loadConvList]);

  const onSubmit = (e) => { e.preventDefault(); send(); };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="assistant-layout">
      {/* ── Sidebar rail ── */}
      <aside className={`assistant-sidebar${sidebarOpen ? ' assistant-sidebar--open' : ''}`}>
        <div className="assistant-sidebar__header">
          <span className="assistant-sidebar__title">Chats</span>
          <button className="assistant-sidebar__new" onClick={newChat} title="New chat">
            <FiPlus />
          </button>
        </div>

        <div className="assistant-sidebar__list">
          {convListLoading && (
            <div className="assistant-sidebar__empty">Loading…</div>
          )}
          {!convListLoading && convList.length === 0 && (
            <div className="assistant-sidebar__empty">No past chats yet.</div>
          )}
          {convList.map((c) => (
            <div
              key={c._id}
              className={`assistant-sidebar__item-wrapper${activeConvId === c._id ? ' assistant-sidebar__item-wrapper--active' : ''}`}
            >
              <button
                className="assistant-sidebar__item"
                onClick={() => selectConversation(c._id)}
              >
                <FiMessageSquare className="assistant-sidebar__item-icon" />
                <div className="assistant-sidebar__item-body">
                  <span className="assistant-sidebar__item-title">{c.title}</span>
                  <span className="assistant-sidebar__item-date">{relativeDate(c.updatedAt)}</span>
                </div>
              </button>
              <button
                className="assistant-sidebar__item-delete"
                onClick={(e) => handleDelete(e, c._id)}
                title="Delete conversation"
                aria-label="Delete conversation"
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="assistant-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main chat panel ── */}
      <div className="assistant-page">
        {/* Mobile header with sidebar toggle */}
        <div className="assistant-mobile-header">
          <button
            className="assistant-mobile-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle conversation list"
          >
            <FiMessageSquare />
          </button>
          <span className="assistant-mobile-title">PRISM Copilot</span>
          <button className="assistant-mobile-new" onClick={newChat} aria-label="New chat">
            <FiPlus />
          </button>
        </div>

        <div className="assistant-chat" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="assistant-welcome">
              <div className="assistant-welcome__icon"><FiCpu /></div>
              <h1>{greeting}</h1>
              <p>Ask for anything — a prep roadmap, the right mentor, a resume check, recolor the app, or where to go next.</p>
              <div className="assistant-suggestions">
                {suggestions.map((s) => (
                  <button key={s} className="assistant-suggestion" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i}>
                <ChatMessage role={m.role} content={m.content} />
                {m.proposedActions?.map((action, j) => (
                  <ProposalCard
                    key={`${i}-${j}`}
                    action={action}
                    conversationId={activeConvId}
                    onConfirmed={(result) => {
                      if (result && result.kind === 'artifact') {
                        setMessages((prev) => prev.map((msg, idx) =>
                          idx === i
                            ? { ...msg, artifacts: [...(msg.artifacts || []), result] }
                            : msg
                        ));
                      }
                      // P5: a confirmed theme change → re-hydrate the user so
                      // AuthContext re-applies the palette immediately.
                      if (result && result.kind === 'theme') {
                        refreshUser?.();
                      }
                    }}
                  />
                ))}
                {m.artifacts?.map((artifact, j) => (
                  <ArtifactCard key={`artifact-${i}-${j}`} artifact={artifact} />
                ))}
              </div>
            ))
          )}

          {loading && (
            <div className="chat-msg chat-msg--assistant">
              <div className="chat-msg__bubble chat-msg__bubble--typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          {error && <div className="assistant-error">{error}</div>}
        </div>

        <form className="assistant-composer" onSubmit={onSubmit}>
          <textarea
            className="assistant-input"
            placeholder="Ask PRISM Copilot…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <button type="submit" className="assistant-send" disabled={loading || !input.trim()} aria-label="Send">
            <FiSend />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
