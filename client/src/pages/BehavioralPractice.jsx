import { useState, useEffect, useCallback } from 'react';
import { getBehavioralQuestions, evaluateBehavioralAnswer } from '../services/api';
import { FiMic, FiRefreshCw, FiArrowRight, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';

// Behavioral PRACTICE — answer an HR-style prompt, get an AI score + STAR
// feedback. Parallel to the STAR Bank (/behavioral), which stores drafts.
const STAR_KEYS = [
    ['situation', 'Situation'],
    ['task', 'Task'],
    ['action', 'Action'],
    ['result', 'Result'],
];

const scoreColor = (s) => (s >= 80 ? 'var(--accent-success, #16a34a)' : s >= 55 ? 'var(--accent-primary)' : 'var(--accent-danger, #dc2626)');

const BehavioralPractice = () => {
    const [questions, setQuestions] = useState([]);
    const [idx, setIdx] = useState(0);
    const [answer, setAnswer] = useState('');
    const [loadingQs, setLoadingQs] = useState(true);
    const [scoring, setScoring] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const loadQuestions = useCallback(async () => {
        setLoadingQs(true);
        try {
            const { data } = await getBehavioralQuestions();
            setQuestions(data.questions || []);
            setIdx(0);
        } catch { setQuestions([]); }
        setLoadingQs(false);
    }, []);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount is the app-wide data pattern
    useEffect(() => { loadQuestions(); }, [loadQuestions]);

    const question = questions[idx] || '';

    const nextQuestion = () => {
        if (!questions.length) return;
        setIdx((i) => (i + 1) % questions.length);
        setAnswer('');
        setResult(null);
        setError('');
    };

    const score = async (e) => {
        e.preventDefault();
        setError('');
        setScoring(true);
        setResult(null);
        try {
            const { data } = await evaluateBehavioralAnswer({ question, answer });
            setResult(data.evaluation);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not score your answer. Try again.');
        }
        setScoring(false);
    };

    return (
        <div className="page">
            <PageHero
                eyebrow="Behavioral"
                title="Behavioral Practice"
                subtitle="Answer a real HR-style question and get an instant AI score on STAR structure, specificity, and relevance — then refine and try again."
                icon={<FiMic />}
                actions={<button className="btn btn-secondary" onClick={loadQuestions} disabled={loadingQs}><FiRefreshCw /> New set</button>}
            />

            <div className="grid grid-2" style={{ alignItems: 'start', gap: 20 }}>
                {/* ── Prompt + answer ── */}
                <Reveal as="div" className="glass-card" i={0} style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <span className="chip" style={{ fontSize: 11 }}>Question {questions.length ? idx + 1 : 0} / {questions.length}</span>
                        <button className="icon-btn" onClick={nextQuestion} disabled={loadingQs || !questions.length} aria-label="Next question"><FiArrowRight /></button>
                    </div>
                    <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.35, minHeight: 52 }}>
                        {loadingQs ? 'Loading a question…' : (question || 'No questions available.')}
                    </h2>

                    <form onSubmit={score} style={{ marginTop: 16 }}>
                        <div className="form-group">
                            <label>Your answer</label>
                            <textarea
                                className="form-textarea"
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Use STAR: set the Situation, your Task, the Action you took, and the measurable Result."
                                rows={10}
                                disabled={!question}
                            />
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{answer.trim().length} characters</div>
                        </div>
                        {error && (
                            <div style={{ color: 'var(--accent-danger, #dc2626)', fontSize: 13, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <FiAlertCircle /> {error}
                            </div>
                        )}
                        <button className="btn btn-primary" style={{ width: '100%' }} disabled={scoring || !question || answer.trim().length < 20}>
                            {scoring ? 'Scoring…' : 'Score my answer'}
                        </button>
                    </form>
                </Reveal>

                {/* ── Feedback ── */}
                <Reveal as="div" className="glass-card" i={1} style={{ padding: 24, minHeight: 240 }}>
                    {!result && !scoring && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', textAlign: 'center', gap: 10, padding: '40px 0' }}>
                            <FiMic size={28} style={{ opacity: 0.5 }} />
                            <p style={{ fontSize: 14 }}>Your AI feedback will appear here after you score an answer.</p>
                        </div>
                    )}
                    {scoring && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 0' }}>
                            <div className="spinner" />
                        </div>
                    )}
                    {result && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                                <span style={{ fontSize: 40, fontWeight: 800, color: scoreColor(result.score) }}>{result.score}</span>
                                <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>/ 100</span>
                            </div>

                            {result.star && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
                                    {STAR_KEYS.map(([k, label]) => (
                                        <div key={k} style={{ textAlign: 'center', background: 'var(--surface-2, rgba(255,255,255,0.04))', borderRadius: 10, padding: '10px 4px' }}>
                                            <div style={{ fontSize: 18, fontWeight: 700 }}>{Number(result.star[k]) || 0}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result.strengths?.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--accent-success, #16a34a)' }}><FiCheckCircle /> Strengths</h4>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            )}

                            {result.improvements?.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--accent-primary)' }}><FiAlertCircle /> To improve</h4>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            )}

                            {result.modelOutline && (
                                <div>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Model STAR outline</h4>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{result.modelOutline}</p>
                                </div>
                            )}
                        </div>
                    )}
                </Reveal>
            </div>
        </div>
    );
};

export default BehavioralPractice;
