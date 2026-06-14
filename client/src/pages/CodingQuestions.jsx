import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    getCodingQuestions, createCodingQuestion, getTopics, runCustomCode,
    submitCodingSolution, getCodingProgress,
} from '../services/api';
import { FiPlus, FiX, FiPlay, FiCode, FiCheckCircle, FiSend } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import SegmentedControl from '../components/ui/SegmentedControl';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

// Fallback starters when a problem ships no boilerplate (e.g. mentor-added ones).
const STARTERS = {
    javascript: 'let _i = "";\nprocess.stdin.on("data", (d) => { _i += d; });\nprocess.stdin.on("end", () => {\n  const lines = _i.trim().split("\\n");\n  // your code here\n});\n',
    python: '# Read input with input() as described, then print your answer.\n\n',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // your code here\n    }\n}\n',
    c: '#include <stdio.h>\n\nint main() {\n    // your code here\n    return 0;\n}\n'
};

const starterFor = (q, lang) => (q?.boilerplate && q.boilerplate[lang]) || STARTERS[lang];

const CodingQuestions = () => {
    const { user } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [topics, setTopics] = useState([]);
    const [filter, setFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', difficulty: 'easy', topic: '', sampleInput: '', sampleOutput: '' });
    const [loading, setLoading] = useState(true);

    // Progress (solved set / streak), loaded once and refreshed after an accept.
    const [progress, setProgress] = useState(null);
    const [solvedSet, setSolvedSet] = useState(new Set());

    // Solve view state
    const [solving, setSolving] = useState(null);
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState(STARTERS.python);
    const [stdin, setStdin] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);      // custom-run output
    const [submitting, setSubmitting] = useState(false);
    const [verdict, setVerdict] = useState(null);     // graded-submit result

    const load = async () => {
        setLoading(true);
        const [q, t] = await Promise.all([getCodingQuestions(filter ? { difficulty: filter } : {}), getTopics()]);
        setQuestions(q.data.questions || []);
        setTopics(t.data.topics || []);
        setLoading(false);
    };

    const loadProgress = async () => {
        try {
            const { data } = await getCodingProgress();
            setProgress(data);
            setSolvedSet(new Set(data.solvedIds || []));
        } catch { /* progress is best-effort */ }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [filter]);
    useEffect(() => { loadProgress(); }, []);

    const openSolve = (q) => {
        setSolving(q);
        setLanguage('python');
        setCode(starterFor(q, 'python'));
        setStdin(q.examples?.[0]?.input || q.sampleInput || '');
        setResult(null);
        setVerdict(null);
    };

    const changeLanguage = (lang) => {
        setLanguage(lang);
        setCode(starterFor(solving, lang));
        setResult(null);
        setVerdict(null);
    };

    const run = async () => {
        setRunning(true);
        setResult(null);
        setVerdict(null);
        try {
            const { data } = await runCustomCode({ sourceCode: code, language, stdin });
            setResult({ output: data.output, error: data.error, exitCode: data.exitCode });
        } catch (err) {
            setResult({ error: err?.response?.data?.message || 'Execution failed. Please try again.', output: '', exitCode: 1 });
        }
        setRunning(false);
    };

    const submit = async () => {
        setSubmitting(true);
        setVerdict(null);
        setResult(null);
        try {
            const { data } = await submitCodingSolution(solving._id, { code, language });
            setVerdict(data);
            if (data.passed) {
                setSolvedSet((prev) => new Set(prev).add(solving._id));
                loadProgress();
            }
        } catch (err) {
            setVerdict({ error: err?.response?.data?.message || 'Submission failed. Please try again.' });
        }
        setSubmitting(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        await createCodingQuestion(form);
        setShowAdd(false);
        load();
    };

    const diffColors = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' };

    return (
        <div className="page">
            <PageHero
                eyebrow="Practice"
                title="Coding Questions"
                subtitle="Solve problems in-browser across five languages, graded against hidden test cases."
                icon={<FiCode />}
                actions={(user?.role === 'mentor' || user?.role === 'admin') && <button className="btn btn-action" onClick={() => setShowAdd(true)}><FiPlus /> Add</button>}
            />

            {progress && (
                <div className="coding-stats" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div className="card" style={{ flex: '1 1 140px', padding: 16 }}>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{progress.solvedCount}<span style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}> / {progress.totalCount}</span></div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Problems solved</div>
                    </div>
                    <div className="card" style={{ flex: '1 1 140px', padding: 16 }}>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>🔥 {progress.streak}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Day streak</div>
                    </div>
                    {['easy', 'medium', 'hard'].map((d) => progress.byDifficulty?.[d] && (
                        <div key={d} className="card" style={{ flex: '1 1 140px', padding: 16 }}>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{progress.byDifficulty[d].solved}<span style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}> / {progress.byDifficulty[d].total}</span></div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{d}</div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginBottom: 24 }}>
                <SegmentedControl
                    id="diff-filter"
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: '', label: 'All' },
                        { value: 'easy', label: 'Easy' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'hard', label: 'Hard' },
                    ]}
                />
            </div>
            {loading ? <SkeletonGrid count={5} cols={1} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {questions.map((q, i) => {
                        const solved = solvedSet.has(q._id);
                        return (
                            <Reveal as="div" key={q._id} i={i} className="card card-clickable spotlight" onClick={() => openSolve(q)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {solved && <FiCheckCircle style={{ color: 'var(--accent-success)', flexShrink: 0 }} title="Solved" />}
                                            {q.title}
                                        </h3>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{q.description?.slice(0, 160)}</p>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span className={`badge ${diffColors[q.difficulty]}`}>{q.difficulty}</span>
                                            {q.topic?.name && <span className="chip">{q.topic.name}</span>}
                                            {q.gradeable && <span className="chip" title="Graded against hidden test cases">Auto-graded</span>}
                                        </div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); openSolve(q); }}><FiCode /> {solved ? 'Review' : 'Solve'}</button>
                                </div>
                            </Reveal>
                        );
                    })}
                    {questions.length === 0 && <div className="empty-state"><p>No questions found</p></div>}
                </div>
            )}

            {/* Solve view */}
            {solving && (
                <Modal onClose={() => setSolving(null)} size="lg">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 20 }}>
                            {solvedSet.has(solving._id) && <FiCheckCircle style={{ color: 'var(--accent-success)', marginRight: 8, verticalAlign: 'middle' }} />}
                            {solving.title} <span className={`badge ${diffColors[solving.difficulty]}`} style={{ marginLeft: 8 }}>{solving.difficulty}</span>
                        </h2>
                        <button className="icon-btn" onClick={() => setSolving(null)}><FiX /></button>
                    </div>
                    <div className="solve-grid">
                        {/* Problem panel */}
                        <div className="solve-problem">
                            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{solving.description}</p>
                            {(solving.examples?.length ? solving.examples : []).map((ex, idx) => (
                                <div key={idx} style={{ marginBottom: 12 }}>
                                    <div className="solve-label">Example {solving.examples.length > 1 ? idx + 1 : ''}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Input</div>
                                    <pre className="solve-pre">{ex.input}</pre>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Output</div>
                                    <pre className="solve-pre">{ex.output}</pre>
                                    {ex.explanation && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{ex.explanation}</p>}
                                </div>
                            ))}
                            {!solving.examples?.length && solving.sampleInput && (
                                <div style={{ marginBottom: 12 }}>
                                    <div className="solve-label">Sample Input</div>
                                    <pre className="solve-pre">{solving.sampleInput}</pre>
                                    {solving.sampleOutput && <><div className="solve-label">Sample Output</div><pre className="solve-pre">{solving.sampleOutput}</pre></>}
                                </div>
                            )}
                        </div>

                        {/* Editor panel */}
                        <div className="solve-editor">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                <select className="form-select" style={{ maxWidth: 160 }} value={language} onChange={(e) => changeLanguage(e.target.value)}>
                                    <option value="python">Python</option>
                                    <option value="javascript">JavaScript</option>
                                    <option value="cpp">C++</option>
                                    <option value="java">Java</option>
                                    <option value="c">C</option>
                                </select>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={run} disabled={running || submitting}>
                                        <FiPlay /> {running ? 'Running…' : 'Run'}
                                    </button>
                                    {solving.gradeable && (
                                        <button className="btn btn-action btn-sm" onClick={submit} disabled={running || submitting}>
                                            <FiSend /> {submitting ? 'Grading…' : 'Submit'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <textarea className="code-editor" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
                            <div className="solve-label" style={{ marginTop: 8 }}>Custom Input (stdin)</div>
                            <textarea className="code-stdin" spellCheck={false} value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Optional input passed to your program when you Run" />

                            {/* Custom-run output */}
                            {result && (
                                <div className="solve-output" style={{ borderColor: result.exitCode === 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                    <div className="solve-label">Output {result.exitCode === 0 ? '✅' : `(exit ${result.exitCode})`}</div>
                                    {result.output && <pre className="solve-pre">{result.output}</pre>}
                                    {result.error && <pre className="solve-pre" style={{ color: 'var(--accent-danger)' }}>{result.error}</pre>}
                                    {!result.output && !result.error && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No output.</p>}
                                </div>
                            )}

                            {/* Graded verdict */}
                            {verdict && (
                                <div className="solve-output" style={{ borderColor: verdict.passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                    {verdict.error ? (
                                        <pre className="solve-pre" style={{ color: 'var(--accent-danger)' }}>{verdict.error}</pre>
                                    ) : (
                                        <>
                                            <div style={{ fontWeight: 700, marginBottom: 8, color: verdict.passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                                {verdict.passed ? '✅ Accepted' : verdict.status === 'runtime_error' ? '⚠️ Runtime Error' : '❌ Wrong Answer'}
                                                {' · '}{verdict.passedCount}/{verdict.totalCount} tests passed
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {verdict.results?.map((r, idx) => (
                                                    <div key={idx} style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                                                        <div style={{ color: r.passed ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>
                                                            Test {idx + 1}: {r.passed ? 'Passed' : 'Failed'}
                                                        </div>
                                                        {!r.passed && (
                                                            <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                                                                <div>Input: <code>{JSON.stringify(r.input)}</code></div>
                                                                <div>Expected: <code>{JSON.stringify(r.expectedOutput)}</code></div>
                                                                <div>Got: <code>{JSON.stringify((r.actualOutput || '').trim())}</code></div>
                                                                {r.error && <div style={{ color: 'var(--accent-danger)' }}>Error: {r.error}</div>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {showAdd && (
                <Modal onClose={() => setShowAdd(false)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Question</h2><button className="icon-btn" onClick={() => setShowAdd(false)}><FiX /></button></div>
                    <form onSubmit={handleCreate}>
                        <div className="form-group"><label>Title</label><input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                        <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
                        <div className="grid grid-2">
                            <div className="form-group"><label>Difficulty</label><select className="form-select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                            <div className="form-group"><label>Topic</label><select className="form-select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}><option value="">Select</option>{topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
                        </div>
                        <div className="form-group"><label>Sample Input</label><input className="form-input" value={form.sampleInput} onChange={(e) => setForm({ ...form, sampleInput: e.target.value })} /></div>
                        <div className="form-group"><label>Sample Output</label><input className="form-input" value={form.sampleOutput} onChange={(e) => setForm({ ...form, sampleOutput: e.target.value })} /></div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Note: manually-added problems are run-only until verified test cases are added.</p>
                        <button className="btn btn-primary" style={{ width: '100%' }}>Add Question</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CodingQuestions;
