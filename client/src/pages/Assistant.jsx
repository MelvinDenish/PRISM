import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FiSend, FiCpu, FiPlus, FiTrash2, FiMessageSquare,
  FiCompass, FiUsers, FiTrendingUp, FiCode,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import {
  sendAssistantMessage,
  streamAssistantMessage,
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

// Rotating brand icons for the welcome suggestion cards (cycled by index).
const SUGGESTION_ICONS = [FiCompass, FiUsers, FiTrendingUp, FiCode];

/** Map an API/network error to a clear, non-alarming sentence for the chat. */
function friendlyError(err) {
  // Axios errors carry err.response; the fetch/SSE path throws plain Errors with .status.
  const status = err?.response?.status ?? err?.status;
  const serverMsg = err?.response?.data?.message || err?.message;
  if (status === 429) return 'PRISM Copilot is busy right now (rate limit). Give it a few seconds and try again.';
  if (status === 503) return serverMsg || 'The assistant isn’t configured on this server yet.';
  if (status === 504 || err?.code === 'ECONNABORTED') return 'That took too long to answer — please try again.';
  if (!status && !err?.response) return 'Network hiccup reaching the assistant — check your connection and try again.';
  return serverMsg || 'The assistant is unavailable right now.';
}

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
  // Tracks the in-flight stream so switching/starting a new chat can cancel it.
  const abortRef = useRef(null);

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
    abortRef.current?.abort(); // cancel any in-flight stream for the previous chat
    setLoading(false);
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
    abortRef.current?.abort(); // cancel any in-flight stream
    setLoading(false);
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

  // Bump a conversation to the top of the sidebar list (newest-first).
  const bumpConv = useCallback((id) => {
    setConvList((prev) => {
      const exists = prev.find((c) => c._id === id);
      if (exists) {
        return [{ ...exists, updatedAt: new Date().toISOString() }, ...prev.filter((c) => c._id !== id)];
      }
      return prev;
    });
  }, []);

  // Send a message — streams the reply token-by-token over SSE, with a non-streaming
  // fallback if the stream can't start. A placeholder assistant message is appended
  // immediately and patched live as tool/token/done events arrive.
  const send = useCallback(async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const capturedId = activeConvId;
    let streamConvId = capturedId;
    // True once the user has navigated away from the chat this send belongs to.
    const stale = () => {
      const cur = activeConvIdRef.current;
      return capturedId === null ? !(cur === null || cur === streamConvId) : cur !== capturedId;
    };

    const tmpId = `tmp-${Date.now()}`;
    const patch = (p) => setMessages((prev) => prev.map((m) =>
      m._tmp === tmpId ? { ...m, ...(typeof p === 'function' ? p(m) : p) } : m
    ));
    const dropPlaceholder = () => setMessages((prev) => prev.filter((m) => m._tmp !== tmpId));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '', proposedActions: [], tools: [], streaming: true, _tmp: tmpId },
    ]);
    setInput('');
    setError('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let sawDone = false;
    let sawError = false;

    const onEvent = (ev) => {
      if (stale()) return;
      switch (ev.type) {
        case 'conversation':
          streamConvId = ev.conversationId;
          if (capturedId === null && activeConvIdRef.current === null) setActiveConvId(ev.conversationId);
          break;
        case 'tool':
          patch({ tools: ev.names || [] });
          break;
        case 'token':
          patch((m) => ({ content: m.content + (ev.delta || ''), tools: [] }));
          break;
        case 'reset':
          patch({ content: '', tools: [] });
          break;
        case 'done':
          sawDone = true;
          patch({ content: ev.reply || '', proposedActions: ev.proposedActions || [], tools: [], streaming: false });
          if (ev.conversationId) {
            setActiveConvId((curr) => curr ?? ev.conversationId);
            bumpConv(ev.conversationId);
            if (!capturedId) loadConvList();
          }
          break;
        case 'error':
          sawError = true;
          setError(ev.message || 'The assistant is unavailable right now.');
          dropPlaceholder();
          break;
        default:
          break;
      }
    };

    try {
      await streamAssistantMessage(
        { conversationId: capturedId, message: content },
        { onEvent, signal: controller.signal }
      );
      // Stream closed without a terminal frame — clear the spinner defensively.
      if (!sawDone && !sawError && !stale()) patch({ streaming: false });
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return; // user switched/started a new chat — the reply persists server-side
      }
      // The stream never started (network / non-2xx) — fall back to non-streaming.
      try {
        const { data } = await sendAssistantMessage({ conversationId: capturedId, message: content });
        if (!stale()) {
          if (data.conversationId) {
            setActiveConvId((curr) => curr ?? data.conversationId);
            bumpConv(data.conversationId);
            if (!capturedId) loadConvList();
          }
          patch({ content: data.reply || '', proposedActions: data.proposedActions || [], tools: [], streaming: false });
        }
      } catch (err2) {
        if (!stale()) { setError(friendlyError(err2)); dropPlaceholder(); }
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }, [input, loading, activeConvId, loadConvList, bumpConv]);

  const onSubmit = (e) => { e.preventDefault(); send(); };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="assistant-layout">
      {/* ── Sidebar rail ── */}
      <aside className={`assistant-sidebar${sidebarOpen ? ' assistant-sidebar--open' : ''}`}>
        <div className="assistant-sidebar__header">
          <button className="assistant-sidebar__new" onClick={newChat} title="New chat">
            <FiPlus /> <span>New chat</span>
          </button>
        </div>

        <div className="assistant-sidebar__section">Recent</div>
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
              <div className="assistant-welcome__mark"><FiCpu /></div>
              <div className="assistant-welcome__eyebrow">PRISM Copilot</div>
              <h1 className="assistant-welcome__title">
                Hi {firstName},<br />
                <span className="assistant-welcome__title-grad">what should we tackle today?</span>
              </h1>
              <p className="assistant-welcome__sub">A prep roadmap, the right mentor, a resume check, or where to go next — just ask.</p>
              <div className="assistant-suggestions">
                {suggestions.map((s, i) => {
                  const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                  return (
                    <button key={s} className="assistant-suggestion" onClick={() => send(s)}>
                      <span className="assistant-suggestion__icon"><Icon /></span>
                      <span className="assistant-suggestion__text">{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i}>
                {m.streaming && !m.content ? (
                  // Streaming placeholder before the first token: show which tools are
                  // running (progress chip) or a typing indicator.
                  <div className="chat-msg chat-msg--assistant">
                    <div className="chat-msg__avatar" aria-hidden="true"><FiCpu /></div>
                    {m.tools?.length ? (
                      <div className="chat-msg__bubble chat-msg__tools">
                        <FiCpu className="chat-msg__tools-icon" />
                        <span>Running {m.tools.join(', ')}…</span>
                      </div>
                    ) : (
                      <div className="chat-msg__bubble chat-msg__bubble--typing">
                        <span /><span /><span />
                      </div>
                    )}
                  </div>
                ) : (
                  <ChatMessage role={m.role} content={m.content} />
                )}
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
