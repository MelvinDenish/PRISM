import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiX, FiArrowRight } from 'react-icons/fi';
import { confirmAssistantAction } from '../../services/api';

/**
 * Renders a write action the assistant has PROPOSED (book a session, create a
 * roadmap, save a resume rewrite) with an explicit Confirm button — the confirm
 * gate. Nothing is written until the user confirms; on confirm we call
 * /api/assistant/confirm, which re-validates server-side. Phase 1 ships no write
 * tools, so this renders only once later phases emit proposals.
 */
const ProposalCard = ({ action, conversationId, onConfirmed }) => {
  // A proposal persisted as already executed (server stamped action.executed on a
  // prior confirm) reloads straight into the Done state — no live Confirm button,
  // so it can't be re-confirmed into a duplicate roadmap / re-book error.
  const [status, setStatus] = useState(action.executed ? 'done' : 'idle'); // idle | working | done | error | dismissed
  const [error, setError] = useState('');
  const [result, setResult] = useState(action.executedResult || null);

  const confirm = async () => {
    setStatus('working');
    setError('');
    try {
      const { data } = await confirmAssistantAction(action, conversationId);
      setResult(data.result || null);
      setStatus('done');
      onConfirmed?.(data.result, action);
    } catch (err) {
      setStatus('error');
      setError(err.response?.data?.message || 'Could not complete the action.');
    }
  };

  if (status === 'dismissed') return null;

  // Navigation handoff (e.g. open_resume_builder): the proposal carries a `link`
  // and no server executor — render an "Open" button that just navigates. This is
  // NOT confirm-gated (nothing is written), unlike the write proposals below.
  if (action.link) {
    return (
      <div className="proposal-card proposal-card--idle">
        <div className="proposal-card__title">{action.title || 'Open'}</div>
        {action.summary && <div className="proposal-card__summary">{action.summary}</div>}
        <div className="proposal-card__actions">
          <Link to={action.link} className="proposal-card__confirm">
            {action.title?.toLowerCase().includes('resume') ? 'Open Resume Builder' : 'Open'} <FiArrowRight />
          </Link>
          <button className="proposal-card__dismiss" onClick={() => setStatus('dismissed')}>
            <FiX /> Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`proposal-card proposal-card--${status}`}>
      <div className="proposal-card__title">{action.title || 'Confirm action'}</div>
      {action.summary && <div className="proposal-card__summary">{action.summary}</div>}

      {status === 'done' && (
        <div className="proposal-card__done">
          <FiCheck /> Done.
          {result?.link && (
            <Link to={result.link} className="proposal-card__result-link">
              {result.kind === 'learning_path' ? 'View your roadmap'
                : result.kind === 'mentorship_session' ? 'View your sessions'
                : result.kind === 'resume_rewrite' ? 'View your resume draft'
                : 'View'} <FiArrowRight />
            </Link>
          )}
        </div>
      )}
      {status === 'error' && <div className="proposal-card__error">{error}</div>}

      {(status === 'idle' || status === 'error') && (
        <div className="proposal-card__actions">
          <button className="proposal-card__confirm" onClick={confirm}>
            <FiCheck /> {status === 'error' ? 'Try again' : 'Confirm'}
          </button>
          <button className="proposal-card__dismiss" onClick={() => setStatus('dismissed')}>
            <FiX /> Dismiss
          </button>
        </div>
      )}
      {status === 'working' && <div className="proposal-card__working">Working…</div>}
    </div>
  );
};

export default ProposalCard;
