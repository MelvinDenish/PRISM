import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTopics, getResources, getLearningPaths, generateLearningPath, updatePathProgress, deleteLearningPath, generatePathTest, submitPathTest } from '../services/api';
import { FiMap, FiPlus, FiTrash2, FiCheckCircle, FiCircle, FiArrowLeft, FiZap, FiExternalLink, FiAlertCircle, FiAward, FiLock, FiPlay } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const LANGS = ['python', 'javascript', 'cpp', 'java', 'c'];

const LearningPaths = () => {
    const [paths, setPaths] = useState([]);
    const [topics, setTopics] = useState([]);
    const [topicResourceCounts, setTopicResourceCounts] = useState({});
    const [selectedPath, setSelectedPath] = useState(null);
    const [creating, setCreating] = useState(false);
    const [newPath, setNewPath] = useState({ topicId: '', level: 'beginner' });
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');
    // Phase 2 — final test state
    const [genTest, setGenTest] = useState(false);
    const [testError, setTestError] = useState('');
    const [showTest, setShowTest] = useState(false);
    const [answers, setAnswers] = useState({});   // mcq: {qId: optionText} | coding: {probId: {language, code}}
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [pathsRes, topicsRes, resourcesRes] = await Promise.all([
                getLearningPaths(), getTopics(), getResources()
            ]);
            setPaths(pathsRes.data.paths || []);
            const topicList = topicsRes.data.topics || [];
            setTopics(topicList);

            // Count resources per topic
            const resources = resourcesRes.data.resources || [];
            const counts = {};
            resources.forEach(r => {
                const tid = typeof r.topic === 'object' ? r.topic?._id : r.topic;
                if (tid) counts[tid] = (counts[tid] || 0) + 1;
            });
            setTopicResourceCounts(counts);
        } catch {}
        setLoading(false);
    };

    const createPath = async () => {
        if (!newPath.topicId) return;
        setGenerating(true);
        setGenerateError('');
        try {
            const { data } = await generateLearningPath(newPath);
            setPaths(prev => [data.path, ...prev]);
            setCreating(false);
            setSelectedPath(data.path);
        } catch (err) {
            const msg = err.response?.data?.message || 'Couldn’t generate the learning path right now. Please try again in a moment.';
            setGenerateError(msg);
        }
        setGenerating(false);
    };

    const toggleStep = async (pathId, stepIndex, completed) => {
        try {
            const { data } = await updatePathProgress(pathId, { stepIndex, completed: !completed });
            setSelectedPath(data.path);
            setPaths(prev => prev.map(p => p._id === pathId ? data.path : p));
        } catch {}
    };

    const removePath = async (id) => {
        try { await deleteLearningPath(id); setPaths(prev => prev.filter(p => p._id !== id)); } catch {}
    };

    const syncPath = (p) => { setSelectedPath(p); setPaths(prev => prev.map(x => x._id === p._id ? p : x)); };

    const generateFinalTest = async () => {
        setGenTest(true); setTestError('');
        try {
            const { data } = await generatePathTest(selectedPath._id);
            syncPath(data.path);
        } catch (err) {
            setTestError(err.response?.data?.message || 'Could not generate the final test.');
        }
        setGenTest(false);
    };

    const openTest = () => {
        const ft = selectedPath.finalTest;
        if (!ft?.generated) return;
        // Seed coding answers with each problem's boilerplate so the editor starts non-empty.
        if (ft.format === 'coding') {
            const seed = {};
            (ft.questions || []).forEach(q => { seed[q.id] = { language: 'python', code: q.boilerplate?.python || '' }; });
            setAnswers(seed);
        } else {
            setAnswers({});
        }
        setResult(null); setTestError(''); setShowTest(true);
    };

    const submitTest = async () => {
        const ft = selectedPath.finalTest;
        setSubmitting(true); setTestError('');
        try {
            const payload = ft.format === 'coding'
                ? Object.entries(answers).map(([id, v]) => ({ id, language: v.language, code: v.code }))
                : Object.entries(answers).map(([id, selectedAnswer]) => ({ id, selectedAnswer }));
            const { data } = await submitPathTest(selectedPath._id, payload);
            setResult(data);
            if (data.path) syncPath(data.path);
        } catch (err) {
            setTestError(err.response?.data?.message || 'Could not submit the test.');
        }
        setSubmitting(false);
    };

    if (selectedPath) {
        return (
            <div className="page">
                <PageHero
                    eyebrow="Learning path"
                    title={selectedPath.title}
                    subtitle={`${selectedPath.description} • ${selectedPath.completedSteps}/${selectedPath.totalSteps} completed`}
                    icon={<FiArrowLeft />}
                    actions={<>
                        <span className="badge badge-primary" style={{ fontSize: 15, padding: '8px 16px' }}>{selectedPath.progress}%</span>
                        <button className="btn btn-secondary" onClick={() => setSelectedPath(null)}><FiArrowLeft /> All paths</button>
                    </>}
                />
                <div className="progress-bar" style={{ marginBottom: 32, height: 6 }}>
                    <div className="fill" style={{ width: `${selectedPath.progress}%` }}></div>
                </div>
                <div className="path-timeline">
                    {(selectedPath.steps || []).map((step, i) => (
                        <Reveal as="div" key={i} i={i} className={`path-step ${step.completed ? 'completed' : i === (selectedPath.steps?.findIndex(s => !s.completed) ?? 0) ? 'active' : ''}`}>
                            <div className="glass-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 20 }}>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: step.completed ? 'var(--accent-success)' : 'var(--text-muted)', fontSize: 22, marginTop: 2, flexShrink: 0 }}
                                    onClick={() => toggleStep(selectedPath._id, i, step.completed)}>
                                    {step.completed ? <FiCheckCircle /> : <FiCircle />}
                                </button>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Step {step.order || i + 1}</p>
                                            <h4 style={{ fontSize: 15, textDecoration: step.completed ? 'line-through' : 'none', opacity: step.completed ? 0.7 : 1 }}>{step.title || step.resourceTitle}</h4>
                                        </div>
                                        {step.estimatedTime && <span className="badge badge-info" style={{ flexShrink: 0 }}>{step.estimatedTime}</span>}
                                    </div>
                                    {step.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>{step.description}</p>}
                                    {step.resourceLink && (
                                        <a href={step.resourceLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)', fontSize: 13, marginTop: 8, textDecoration: 'none' }}>
                                            <FiExternalLink /> Open Resource
                                        </a>
                                    )}
                                </div>
                            </div>
                        </Reveal>
                    ))}

                    {/* ── Final Test (locked last step) ── */}
                    {(() => {
                        const total = selectedPath.totalSteps || selectedPath.steps?.length || 0;
                        const allDone = total > 0 && (selectedPath.completedSteps || 0) >= total;
                        const ft = selectedPath.finalTest;
                        const passed = selectedPath.passed;
                        const cert = selectedPath.certificate;
                        return (
                            <Reveal as="div" className={`path-step ${passed ? 'completed' : allDone ? 'active' : ''}`}>
                                <div className="glass-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 20 }}>
                                    <span style={{ fontSize: 22, marginTop: 2, flexShrink: 0, color: passed ? 'var(--accent-success)' : allDone ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                        {passed ? <FiAward /> : allDone ? <FiPlay /> : <FiLock />}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Final Test · ≥{selectedPath.passThreshold || 90}% to pass</p>
                                        <h4 style={{ fontSize: 15 }}>Path Completion Test {passed && <span className="badge badge-success" style={{ marginLeft: 8 }}>Passed · {selectedPath.bestScore}%</span>}</h4>

                                        {!allDone && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>Complete all {total} steps to unlock the final test.</p>}

                                        {testError && <p style={{ color: 'var(--accent-danger)', fontSize: 13, marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}><FiAlertCircle /> {testError}</p>}

                                        {allDone && !passed && !ft?.generated && (
                                            <button className="btn btn-action btn-sm" style={{ marginTop: 10 }} onClick={generateFinalTest} disabled={genTest}>
                                                <FiZap /> {genTest ? 'Generating test…' : 'Generate Final Test'}
                                            </button>
                                        )}
                                        {allDone && ft?.generated && !passed && (
                                            <button className="btn btn-action btn-sm" style={{ marginTop: 10 }} onClick={openTest}><FiPlay /> Take Final Test ({ft.questions?.length} {ft.format === 'coding' ? 'problems' : 'questions'})</button>
                                        )}
                                        {ft?.generated && !passed && (
                                            <button className="btn btn-secondary btn-sm" style={{ marginTop: 10, marginLeft: 8 }} onClick={openTest}>Retake</button>
                                        )}
                                        {passed && cert?.certId && (
                                            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <Link className="btn btn-action btn-sm" to={`/certificate/${cert.certId}`} target="_blank"><FiAward /> View Certificate</Link>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Verifiable PRISM achievement</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Reveal>
                        );
                    })()}
                </div>

                {showTest && selectedPath.finalTest?.generated && (
                    <Modal onClose={() => setShowTest(false)} size="lg">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 20 }}>Final Test — {selectedPath.title}</h2>
                            <span className="badge badge-primary">≥{selectedPath.passThreshold || 90}% to pass</span>
                        </div>

                        {result ? (
                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                <div style={{ fontSize: 48, fontWeight: 800, color: result.passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{result.score}%</div>
                                <p style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{result.passed ? 'Passed! 🎉' : `Not yet — you need ${result.threshold}%`}</p>
                                {result.passed && result.certificate?.certId && (
                                    <Link className="btn btn-action" style={{ marginTop: 16 }} to={`/certificate/${result.certificate.certId}`} target="_blank"><FiAward /> View your certificate</Link>
                                )}
                                {!result.passed && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setResult(null)}>Try again</button>}
                            </div>
                        ) : (
                            <>
                                <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 8 }}>
                                    {selectedPath.finalTest.format === 'coding' ? (
                                        (selectedPath.finalTest.questions || []).map((q, qi) => (
                                            <div key={q.id} className="glass-card" style={{ padding: 16, marginBottom: 14 }}>
                                                <h4 style={{ fontSize: 15, marginBottom: 6 }}>{qi + 1}. {q.title} <span className="badge badge-info" style={{ marginLeft: 6 }}>{q.difficulty}</span></h4>
                                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 10 }}>{q.description}</p>
                                                <select className="form-select" style={{ marginBottom: 8 }} value={answers[q.id]?.language || 'python'} onChange={e => setAnswers(a => ({ ...a, [q.id]: { language: e.target.value, code: q.boilerplate?.[e.target.value] || a[q.id]?.code || '' } }))}>
                                                    {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                                <textarea className="form-textarea" style={{ fontFamily: 'monospace', fontSize: 13 }} rows={8} value={answers[q.id]?.code || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: { ...a[q.id], language: a[q.id]?.language || 'python', code: e.target.value } }))} />
                                            </div>
                                        ))
                                    ) : (
                                        (selectedPath.finalTest.questions || []).map((q, qi) => (
                                            <div key={q.id} style={{ marginBottom: 18 }}>
                                                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.q}</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {(q.opts || []).map((opt, oi) => (
                                                        <label key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: answers[q.id] === opt ? 'var(--surface-2, rgba(255,255,255,0.06))' : 'transparent' }}>
                                                            <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {testError && <p style={{ color: 'var(--accent-danger)', fontSize: 13, margin: '10px 0' }}>{testError}</p>}
                                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={submitTest} disabled={submitting}>{submitting ? 'Grading…' : 'Submit Test'}</button>
                            </>
                        )}
                    </Modal>
                )}
            </div>
        );
    }

    // Sort topics: ones with resources first
    const sortedTopics = [...topics].sort((a, b) => {
        const ca = topicResourceCounts[a._id] || 0;
        const cb = topicResourceCounts[b._id] || 0;
        return cb - ca;
    });

    return (
        <div className="page">
            <PageHero
                eyebrow="Prepare"
                title="Learning Paths"
                subtitle="AI-generated roadmaps that sequence the right resources for your level."
                icon={<FiMap />}
                actions={<button className="btn btn-action" onClick={() => { setCreating(true); setGenerateError(''); }}><FiPlus /> New Path</button>}
            />

            {creating && (
                <Modal onClose={() => setCreating(false)}>
                        <h2>Create Learning Path</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>AI will generate a personalized learning roadmap based on your level.</p>
                        <div className="form-group">
                            <label>Select Topic</label>
                            <select className="form-select" value={newPath.topicId} onChange={e => setNewPath(prev => ({ ...prev, topicId: e.target.value }))}>
                                <option value="">Choose a topic...</option>
                                {sortedTopics.map(t => {
                                    const count = topicResourceCounts[t._id] || 0;
                                    return (
                                        <option key={t._id} value={t._id} disabled={count === 0}>
                                            {t.name} {count > 0 ? `(${count} resources)` : '— no resources yet'}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Your Current Level</label>
                            <select className="form-select" value={newPath.level} onChange={e => setNewPath(prev => ({ ...prev, level: e.target.value }))}>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                        {generateError && (
                            <div style={{ padding: '10px 14px', background: 'rgba(192,70,43,0.08)', border: '1px solid rgba(192,70,43,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-danger)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FiAlertCircle /> {generateError}
                            </div>
                        )}
                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={createPath} disabled={generating || !newPath.topicId}>
                            <FiZap /> {generating ? 'AI is generating your path...' : 'Generate Path'}
                        </button>
                </Modal>
            )}

            {loading ? <SkeletonGrid count={4} cols={2} /> : paths.length === 0 ? (
                <div className="empty-state"><div className="icon"><FiMap /></div><p>No learning paths yet. Create one to get a personalized roadmap!</p></div>
            ) : (
                <div className="grid grid-2">
                    {paths.map((path, i) => (
                        <Reveal as="div" key={path._id} i={i} className="glass-card spotlight" style={{ cursor: 'pointer' }} onClick={() => setSelectedPath(path)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                    <h3 style={{ fontSize: 16, marginBottom: 4 }}>{path.title}</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{path.topic?.name || 'Topic'} • {path.level}</p>
                                </div>
                                <button className="btn btn-sm" style={{ background: 'none', color: 'var(--accent-danger)' }} onClick={e => { e.stopPropagation(); removePath(path._id); }}><FiTrash2 /></button>
                            </div>
                            <div className="progress-bar" style={{ marginBottom: 8, height: 6 }}>
                                <div className="fill" style={{ width: `${path.progress}%` }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                                <span>{path.completedSteps}/{path.totalSteps} completed</span>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{path.progress}%</span>
                            </div>
                        </Reveal>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LearningPaths;
