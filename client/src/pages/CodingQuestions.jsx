import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCodingQuestions, createCodingQuestion, getTopics, runCustomCode } from '../services/api';
import { FiPlus, FiX, FiPlay, FiCode } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import SegmentedControl from '../components/ui/SegmentedControl';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const STARTERS = {
    javascript: '// Read input from stdin if needed, then write your solution.\n\nfunction solve() {\n  // your code here\n  console.log("Hello, PRISM");\n}\n\nsolve();\n',
    python: '# Read input with input() if needed, then write your solution.\n\ndef solve():\n    # your code here\n    print("Hello, PRISM")\n\nsolve()\n',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    cout << "Hello, PRISM" << endl;\n    return 0;\n}\n',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // your code here\n        System.out.println("Hello, PRISM");\n    }\n}\n',
    c: '#include <stdio.h>\n\nint main() {\n    // your code here\n    printf("Hello, PRISM\\n");\n    return 0;\n}\n'
};

const CodingQuestions = () => {
    const { user } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [topics, setTopics] = useState([]);
    const [filter, setFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', difficulty: 'easy', topic: '', sampleInput: '', sampleOutput: '' });
    const [loading, setLoading] = useState(true);

    // Solve view state
    const [solving, setSolving] = useState(null);
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState(STARTERS.python);
    const [stdin, setStdin] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => { load(); }, [filter]);
    const load = async () => {
        setLoading(true);
        const [q, t] = await Promise.all([getCodingQuestions(filter ? { difficulty: filter } : {}), getTopics()]);
        setQuestions(q.data.questions || []);
        setTopics(t.data.topics || []);
        setLoading(false);
    };

    const openSolve = (q) => {
        setSolving(q);
        setLanguage('python');
        setCode(STARTERS.python);
        setStdin(q.sampleInput || '');
        setResult(null);
    };

    const changeLanguage = (lang) => {
        setLanguage(lang);
        setCode(STARTERS[lang]);
        setResult(null);
    };

    const run = async () => {
        setRunning(true);
        setResult(null);
        try {
            const { data } = await runCustomCode({ sourceCode: code, language, stdin });
            setResult({ output: data.output, error: data.error, exitCode: data.exitCode });
        } catch (err) {
            setResult({ error: err?.response?.data?.message || 'Execution failed. Please try again.', output: '', exitCode: 1 });
        }
        setRunning(false);
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
                subtitle="Solve problems in-browser across five languages, with instant run."
                icon={<FiCode />}
                actions={(user?.role === 'mentor' || user?.role === 'admin') && <button className="btn btn-action" onClick={() => setShowAdd(true)}><FiPlus /> Add</button>}
            />
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
                    {questions.map((q, i) => (
                        <Reveal as="div" key={q._id} i={i} className="card card-clickable spotlight" onClick={() => openSolve(q)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{q.title}</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{q.description?.slice(0, 200)}</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span className={`badge ${diffColors[q.difficulty]}`}>{q.difficulty}</span>
                                        {q.topic?.name && <span className="chip">{q.topic.name}</span>}
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); openSolve(q); }}><FiCode /> Solve</button>
                            </div>
                        </Reveal>
                    ))}
                    {questions.length === 0 && <div className="empty-state"><p>No questions found</p></div>}
                </div>
            )}

            {/* Solve view */}
            {solving && (
                <Modal onClose={() => setSolving(null)} size="lg">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 20 }}>{solving.title} <span className={`badge ${diffColors[solving.difficulty]}`} style={{ marginLeft: 8 }}>{solving.difficulty}</span></h2>
                            <button className="icon-btn" onClick={() => setSolving(null)}><FiX /></button>
                        </div>
                        <div className="solve-grid">
                            {/* Problem panel */}
                            <div className="solve-problem">
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{solving.description}</p>
                                {solving.sampleInput && (
                                    <div style={{ marginBottom: 12 }}>
                                        <div className="solve-label">Sample Input</div>
                                        <pre className="solve-pre">{solving.sampleInput}</pre>
                                    </div>
                                )}
                                {solving.sampleOutput && (
                                    <div>
                                        <div className="solve-label">Sample Output</div>
                                        <pre className="solve-pre">{solving.sampleOutput}</pre>
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
                                    <button className="btn btn-action btn-sm" onClick={run} disabled={running}>
                                        <FiPlay /> {running ? 'Running…' : 'Run'}
                                    </button>
                                </div>
                                <textarea className="code-editor" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
                                <div className="solve-label" style={{ marginTop: 8 }}>Custom Input (stdin)</div>
                                <textarea className="code-stdin" spellCheck={false} value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Optional input passed to your program" />
                                {result && (
                                    <div className="solve-output" style={{ borderColor: result.exitCode === 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                        <div className="solve-label">Output {result.exitCode === 0 ? '✅' : `(exit ${result.exitCode})`}</div>
                                        {result.output && <pre className="solve-pre">{result.output}</pre>}
                                        {result.error && <pre className="solve-pre" style={{ color: 'var(--accent-danger)' }}>{result.error}</pre>}
                                        {!result.output && !result.error && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No output.</p>}
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
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Question</button>
                        </form>
                </Modal>
            )}
        </div>
    );
};

export default CodingQuestions;
