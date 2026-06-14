import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getResumeDrafts, getResumeDraft, deleteResumeDraft, resumeIntake, authorResume,
  regenerateResume, exportResumeDraft, downloadArtifact,
  draftResumeContent, applyResumeContent,
} from '../services/api';
import {
  FiTrash2, FiDownload, FiZap, FiFileText, FiSend, FiMessageSquare,
  FiArrowLeft, FiRefreshCw, FiFile, FiEdit3, FiCheckCircle, FiCircle,
} from 'react-icons/fi';
import PageHero from '../components/ui/PageHero';
import Reveal from '../components/motion/Reveal';

/**
 * Generative Resume — the LLM authors a complete, unique HTML resume from the
 * student's details. ONE door: "Generate from my profile" opens a profile-seeded
 * gap-fill chat that asks only for what's missing and shows a live checklist; the
 * Generate button unlocks only once the quality gate is met (enforced server-side
 * too). The result is a sandboxed iframe (no scripts), with Regenerate (new
 * design), Refine (instruction), and PDF/DOCX download.
 */
const CHAT_GREETING = "Hi! I'm your resume copilot. Tell me about yourself and your projects — I'll ask a few quick questions, then design a complete resume. (Your saved profile is already filled in.)";

const ResumeBuilder = () => {
  const [drafts, setDrafts] = useState([]);
  const [view, setView] = useState('list'); // list | chat | result
  const [current, setCurrent] = useState(null); // full draft (with generatedHtml)
  const [busy, setBusy] = useState('');         // '' | 'generating' | 'regenerating' | 'exporting-pdf' | 'exporting-docx'
  const [error, setError] = useState('');

  // chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [collected, setCollected] = useState(null);   // accumulated resume content (echoed back each turn)
  const [assessment, setAssessment] = useState(null); // { have, missing, gateMet, contentScore }
  const [draftCard, setDraftCard] = useState(null);   // [{name,description,technologies}] editable "fill a page" draft
  const [drafting, setDrafting] = useState(false);    // busy flag for the draft / apply calls
  const chatRef = useRef(null);

  // refine state
  const [instruction, setInstruction] = useState('');

  const [params, setParams] = useSearchParams();

  useEffect(() => { loadDrafts(); }, []);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, sending, draftCard, drafting]);

  // Honor copilot/deep-link handoffs: ?start=generate or ?start=chat both open the
  // gated chat (a direct generate would bypass the completeness gate).
  useEffect(() => {
    const start = params.get('start');
    if (!start) return;
    setParams({}, { replace: true });
    if (start === 'generate' || start === 'chat') startChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDrafts = async () => {
    try { const { data } = await getResumeDrafts(); setDrafts(data.drafts || []); } catch { /* noop */ }
  };

  // ── Gap-fill chat ──
  // Opening the chat immediately seeds from the profile (empty messages) so the
  // first assistant turn is a targeted question + the initial checklist.
  const startChat = async () => {
    setError(''); setCurrent(null); setCollected(null); setAssessment(null);
    setDraftCard(null); setDrafting(false);
    setMessages([]); setInput(''); setView('chat'); setSending(true);
    try {
      const { data } = await resumeIntake([], null);
      setMessages([{ role: 'assistant', content: data.reply || CHAT_GREETING }]);
      setCollected(data.collected);
      setAssessment(data.assessment);
    } catch (err) {
      setMessages([{ role: 'assistant', content: CHAT_GREETING }]);
      setError(err?.response?.data?.message || err.message || 'Could not start the chat.');
    }
    setSending(false);
  };

  const sendChat = async () => {
    const text = input.trim();
    if (!text || sending || drafting) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next); setInput(''); setSending(true); setError('');
    try {
      const { data } = await resumeIntake(next, collected);
      setMessages((p) => [...p, { role: 'assistant', content: data.reply || 'Tell me a bit more.' }]);
      setCollected(data.collected);
      setAssessment(data.assessment);
      setSending(false);
      // The agent decided "draft it for them" (e.g. user said "yes" / "generate urself"
      // at the content stage) — open the editable project draft right away.
      if (data.assist === 'content') draftProjectContent(data.collected);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Something went wrong. Try again.');
      setSending(false);
    }
  };

  // ── "Fill a page for me" assist ──
  // Ask the AI to expand the project briefs into fuller descriptions, then show them
  // inline as editable text. Nothing is committed until the user accepts.
  const draftProjectContent = async (collectedArg) => {
    const src = collectedArg || collected;
    if (!src || drafting) return;
    setError(''); setDrafting(true);
    try {
      const { data } = await draftResumeContent(src);
      const drafted = (data.draftedProjects || []).map((p) => ({
        name: p.name || '', description: p.description || '', technologies: p.technologies || '',
      }));
      if (!drafted.length) throw new Error('No project details to draft yet — add a project first.');
      setDraftCard(drafted);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not draft your project details. Try again.');
    }
    setDrafting(false);
  };

  const updateDraftField = (idx, value) => {
    setDraftCard((prev) => (prev ? prev.map((p, i) => (i === idx ? { ...p, description: value } : p)) : prev));
  };

  // Accept the (edited) draft: fold it back through the server gate so the checklist,
  // the Generate button, and the server wall all agree.
  const applyDraftedContent = async () => {
    if (!draftCard || drafting) return;
    setError(''); setDrafting(true);
    try {
      const { data } = await applyResumeContent(collected, draftCard);
      setCollected(data.collected);
      setAssessment(data.assessment);
      setDraftCard(null);
      // Generation is gated on the FACTUAL items, which are already in by this stage —
      // so Generate is unlocked whether or not the page-fill bar is now met.
      const fullPage = !(data.assessment?.missing || []).some((m) => m.key === 'enoughContent');
      setMessages((p) => [...p, { role: 'assistant', content: fullPage
        ? 'Great — I’ve folded those in and your resume now fills the page nicely. Hit “Generate my resume” whenever you’re ready.'
        : 'Added those in — that’s plenty to generate a solid resume. Hit “Generate my resume” when you’re ready, or add a little more for extra depth.' }]);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not save those details. Try again.');
    }
    setDrafting(false);
  };

  const cancelDraft = () => { setDraftCard(null); setError(''); };

  // Generate from the confirmed (gate-met) content.
  const confirmGenerate = async () => {
    if (!collected || !assessment?.gateMet) return;
    setError(''); setView('result'); setBusy('generating');
    try {
      const { data } = await authorResume({ collected });
      setCurrent(data.draft);
      loadDrafts();
    } catch (err) {
      // 422 → gate not met server-side; surface the returned assessment.
      const a = err?.response?.data?.assessment;
      if (a) setAssessment(a);
      setError(err?.response?.data?.message || err.message || 'Could not generate your resume.');
      setView('chat');
    }
    setBusy('');
  };

  // ── Result actions ──
  const regenerate = async (steer) => {
    if (!current?._id) return;
    setError(''); setBusy('regenerating');
    try {
      const { data } = await regenerateResume(current._id, steer);
      setCurrent(data.draft);
      if (steer) setInstruction('');
      loadDrafts();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Regeneration failed.');
    }
    setBusy('');
  };

  const refine = () => { const s = instruction.trim(); if (s) regenerate(s); };

  const exportDraft = async (fmt) => {
    if (!current?._id) return;
    setError(''); setBusy(`exporting-${fmt}`);
    try {
      const { data } = await exportResumeDraft(current._id, fmt);
      if (!data?.artifact?.id) throw new Error('No file produced');
      const filename = data.fileName || `${current.personalInfo?.fullName || current.name || 'resume'}.${fmt}`;
      await downloadArtifact(data.artifact.id, filename);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || `${fmt.toUpperCase()} export failed.`);
    }
    setBusy('');
  };

  const openDraft = async (d) => {
    setError(''); setView('result'); setBusy('generating'); setCurrent(null);
    try { const { data } = await getResumeDraft(d._id); setCurrent(data.draft); }
    catch (err) { setError(err?.response?.data?.message || 'Could not open that resume.'); setView('list'); }
    setBusy('');
  };

  const removeDraft = async (id) => { try { await deleteResumeDraft(id); loadDrafts(); } catch { /* noop */ } };

  // ════════════════════════════ LIST ════════════════════════════
  if (view === 'list') {
    return (
      <div className="page">
        <PageHero
          eyebrow="Career"
          title="Resume Builder"
          subtitle="Answer a few quick questions and the AI designs a complete, one-of-a-kind resume from your details — no two students get the same look."
          icon={<FiFileText />}
          actions={(
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-action" onClick={startChat}><FiZap /> Generate from my profile</button>
            </div>
          )}
        />
        {error && <p className="rb-canvas-error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
        {drafts.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><FiFileText /></div>
            <p>No resumes yet. Click <strong>Generate from my profile</strong> — I'll fill the gaps with a few quick questions, then design it.</p>
            <button className="btn btn-action" style={{ marginTop: 16 }} onClick={startChat}><FiZap /> Generate from my profile</button>
          </div>
        ) : (
          <div className="grid grid-3">
            {drafts.map((d, i) => (
              <Reveal as="div" key={d._id} i={i} className="glass-card spotlight" style={{ cursor: 'pointer' }} onClick={() => openDraft(d)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div><h3 style={{ fontSize: 16 }}>{d.name}</h3><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.generatedHtml ? 'AI-designed' : d.template ? `${d.template} template` : 'Draft'}</p></div>
                  <button className="btn btn-sm" style={{ background: 'none', color: 'var(--accent-danger)' }} onClick={(e) => { e.stopPropagation(); removeDraft(d._id); }}><FiTrash2 /></button>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{d.personalInfo?.fullName || 'No name'}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>Updated {new Date(d.updatedAt).toLocaleDateString()}</p>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════ CHAT ════════════════════════════
  if (view === 'chat') {
    const canSend = input.trim() && !sending && !drafting;
    const gateMet = !!assessment?.gateMet;
    const missing = assessment?.missing || [];
    const have = assessment?.have || [];
    const total = missing.length + have.length;
    // `enoughContent` is advisory (doesn't block generation). Blocking gaps are the
    // factual items; the "fill a page" stage is when those are all done and only the
    // advisory item remains — where the AI-draft assist (not a typing wall) takes over.
    const blockingMissing = missing.filter((m) => m.key !== 'enoughContent');
    const onlyContentMissing = blockingMissing.length === 0 && missing.some((m) => m.key === 'enoughContent');
    return (
      <div className="page">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setView('list')}><FiArrowLeft /> Back</button>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}><FiMessageSquare style={{ verticalAlign: '-2px', marginRight: 6 }} />Generate from my profile</h2>
        </div>
        <div className="rb-chat-grid">
          <div className="glass-card rb-chat">
            <div className="rb-chat-log" ref={chatRef}>
              {messages.map((m, i) => (
                <div key={i} className={`rb-chat-msg rb-chat-${m.role}`}>
                  <span className="rb-chat-bubble">{m.content}</span>
                </div>
              ))}
              {sending && <div className="rb-chat-msg rb-chat-assistant"><span className="rb-chat-bubble rb-chat-typing">Thinking…</span></div>}
              {drafting && !draftCard && <div className="rb-chat-msg rb-chat-assistant"><span className="rb-chat-bubble rb-chat-typing">Drafting your project details…</span></div>}

              {/* Editable "fill a page" draft — the AI wrote these from the user's own
                  briefs; they only count once the user edits and accepts. */}
              {draftCard && (
                <div className="rb-draft-card">
                  <div className="rb-draft-head"><FiEdit3 style={{ verticalAlign: '-2px', marginRight: 6 }} />Fuller project details — edit anything, then tap “Use this”</div>
                  {draftCard.map((p, i) => (
                    <div key={i} className="rb-draft-item">
                      <div className="rb-draft-name">
                        {p.name}{p.technologies ? <span className="rb-draft-tech">{p.technologies}</span> : null}
                      </div>
                      <textarea className="form-textarea" rows={3} value={p.description}
                        onChange={(e) => updateDraftField(i, e.target.value)} disabled={drafting} />
                    </div>
                  ))}
                  <div className="rb-draft-actions">
                    <button className="btn btn-action btn-sm" onClick={applyDraftedContent} disabled={drafting}>
                      <FiCheckCircle /> {drafting ? 'Saving…' : 'Use this'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={cancelDraft} disabled={drafting}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
            {error && <p className="rb-canvas-error" role="alert">{error}</p>}

            <div className="rb-chat-input">
              <textarea className="form-textarea" rows={2} placeholder="Type your answer…" value={input}
                onChange={(e) => setInput(e.target.value)} disabled={sending}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) sendChat(); } }} />
              <button className="btn btn-action" onClick={sendChat} disabled={!canSend}><FiSend /> {sending ? 'Sending…' : 'Send'}</button>
            </div>
            <p className="rb-canvas-help">Press Enter to send · Shift+Enter for a new line. We never invent employers, degrees, or metrics you don't provide.</p>
          </div>

          {/* Live completeness checklist + gated Generate */}
          <aside className="glass-card rb-checklist">
            <div className="rb-checklist-head">
              <h3>Resume checklist</h3>
              {total > 0 && (
                <span className={`rb-checklist-count ${gateMet ? 'is-ready' : ''}`}>
                  {have.length}/{total}
                </span>
              )}
            </div>

            {missing.length > 0 && (
              <ul className="rb-check-list">
                {missing.map((m) => (
                  <li key={m.key} className="rb-check-item rb-check-todo">
                    <FiCircle className="rb-check-ic" />
                    <span><strong>{m.label}</strong><em>{m.hint}</em></span>
                  </li>
                ))}
              </ul>
            )}
            {have.length > 0 && (
              <ul className="rb-check-list rb-check-have">
                {have.map((h) => (
                  <li key={h.key} className="rb-check-item rb-check-done">
                    <FiCheckCircle className="rb-check-ic" />
                    <span>{h.label}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Only at the "fill a page" stage: offer to draft the depth instead of
                making the user type past the word-count bar. */}
            {onlyContentMissing && !draftCard && (
              <button className="btn btn-secondary rb-draft-btn" onClick={() => draftProjectContent()} disabled={drafting || sending}>
                <FiEdit3 /> {drafting ? 'Drafting…' : 'Draft my project details'}
              </button>
            )}
            <button className="btn btn-action rb-generate-btn" onClick={confirmGenerate} disabled={!gateMet || sending || drafting}>
              <FiZap /> Generate my resume
            </button>
            <p className="rb-canvas-help" style={{ marginTop: 8, textAlign: 'center' }}>
              {onlyContentMissing
                ? 'You can generate now — or let me draft fuller project details first to fill the page.'
                : gateMet
                  ? "You've hit the bar — generate now, or keep adding for an even stronger resume."
                  : blockingMissing.length
                    ? `Answer ${blockingMissing.length} more to unlock generation.`
                    : 'Add your details to unlock generation.'}
            </p>
          </aside>
        </div>
      </div>
    );
  }

  // ════════════════════════════ RESULT ════════════════════════════
  const generating = busy === 'generating';
  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setView('list')}><FiArrowLeft /> Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{current?.name || 'Your resume'}</h2>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => regenerate()} disabled={!current || !!busy}>
            <FiRefreshCw /> {busy === 'regenerating' ? 'Redesigning…' : 'Regenerate'}
          </button>
          <button className="btn btn-action btn-sm" onClick={() => exportDraft('pdf')} disabled={!current || !!busy}>
            <FiDownload /> {busy === 'exporting-pdf' ? 'PDF…' : 'PDF'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportDraft('docx')} disabled={!current || !!busy}>
            <FiFile /> {busy === 'exporting-docx' ? 'DOCX…' : 'DOCX'}
          </button>
        </div>
      </div>

      {error && <p className="rb-canvas-error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      {/* Refine box */}
      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div className="rb-cmd-row">
          <input className="form-input rb-cmd-input" type="text" maxLength={400}
            placeholder='Tell it what to change — e.g. "make the summary punchier", "use a blue two-column layout"'
            value={instruction} onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && instruction.trim() && !busy) refine(); }}
            disabled={!current || !!busy} />
          <button className="btn btn-primary" onClick={refine} disabled={!current || !instruction.trim() || !!busy}>
            <FiEdit3 /> {busy === 'regenerating' ? 'Working…' : 'Refine'}
          </button>
        </div>
        {current?.generationMeta && current.generationMeta.verified === false && (
          <p className="rb-canvas-help" style={{ marginTop: 8, color: 'var(--accent-warning)' }}>
            Heads up: this design may overflow — try Regenerate or refine to tighten it.
          </p>
        )}
      </div>

      {/* Live preview (sandboxed iframe — no scripts) */}
      <div className="rb-preview-bar">
        <span className="rb-preview-label"><FiCheckCircle style={{ verticalAlign: '-2px', marginRight: 6 }} />Live preview · this is exactly what downloads</span>
      </div>
      <div style={{ background: 'var(--bg-input, #1115)', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center' }}>
        {generating ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p>Designing your resume… this takes a few seconds.</p>
          </div>
        ) : current?.generatedHtml ? (
          <iframe
            title="Resume preview"
            sandbox=""
            srcDoc={current.generatedHtml}
            style={{ width: 794, maxWidth: '100%', height: 1123, border: '1px solid var(--border-color)', borderRadius: 4, background: '#fff' }}
          />
        ) : (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>
            <FiFileText style={{ fontSize: 32, opacity: 0.5 }} />
            <p>No preview yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeBuilder;
