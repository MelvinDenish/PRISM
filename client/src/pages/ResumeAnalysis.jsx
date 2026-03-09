import { useState, useEffect } from 'react';
import { analyzeResume, getAnalysisHistory } from '../services/api';
import { FiUpload, FiTarget, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';

const ResumeAnalysis = () => {
    const [resumeText, setResumeText] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('analyze');

    useEffect(() => {
        getAnalysisHistory()
            .then((res) => setHistory(res.data.analyses || []))
            .catch(() => { });
    }, []);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await analyzeResume({ resumeText, jobDescription });
            setAnalysis(res.data.analysis);
            // Refresh history
            const hRes = await getAnalysisHistory();
            setHistory(hRes.data.analyses || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        setResumeText(text);
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'var(--accent-success)';
        if (score >= 60) return 'var(--accent-warning)';
        return 'var(--accent-danger)';
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📄 <span>Resume ATS Analysis</span></h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`btn btn-sm ${tab === 'analyze' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('analyze')}>Analyze</button>
                    <button className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('history')}>History ({history.length})</button>
                </div>
            </div>

            {tab === 'analyze' ? (
                <div className="grid grid-2">
                    {/* Input Form */}
                    <div className="glass-card">
                        <h3 style={{ marginBottom: 20 }}>Upload & Analyze</h3>
                        <form onSubmit={handleAnalyze}>
                            <div className="form-group">
                                <label>Resume Content</label>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        <FiUpload /> Upload .txt
                                        <input type="file" accept=".txt,.text" style={{ display: 'none' }} onChange={handleFileUpload} />
                                    </label>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>or paste below</span>
                                </div>
                                <textarea className="form-textarea" value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume text here..." style={{ minHeight: 200 }} required />
                            </div>
                            <div className="form-group">
                                <label>Job Description</label>
                                <textarea className="form-textarea" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description you're targeting..." style={{ minHeight: 150 }} required />
                            </div>
                            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                                {loading ? '🔍 Analyzing...' : '🔍 Analyze Resume'}
                            </button>
                        </form>
                    </div>

                    {/* Results */}
                    <div>
                        {analysis ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Match Score */}
                                <div className="glass-card" style={{ textAlign: 'center' }}>
                                    <h3 style={{ marginBottom: 16 }}>ATS Match Score</h3>
                                    <div style={{ width: 120, height: 120, borderRadius: '50%', border: `4px solid ${getScoreColor(analysis.matchScore)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36, fontWeight: 800, color: getScoreColor(analysis.matchScore) }}>
                                        {analysis.matchScore}%
                                    </div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                        {analysis.matchScore >= 80 ? '🎉 Great match!' : analysis.matchScore >= 60 ? '⚡ Good, but can improve' : '⚠️ Needs significant improvement'}
                                    </p>
                                </div>

                                {/* Missing Keywords */}
                                {analysis.missingKeywords?.length > 0 && (
                                    <div className="glass-card">
                                        <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FiTarget style={{ color: 'var(--accent-warning)' }} /> Missing Keywords</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {analysis.missingKeywords.map((k, i) => (
                                                <span key={i} className="badge badge-warning">{k}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Red Flags */}
                                {analysis.redFlags?.length > 0 && (
                                    <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                        <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FiAlertTriangle style={{ color: 'var(--accent-danger)' }} /> ATS Red Flags</h3>
                                        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2 }}>
                                            {analysis.redFlags.map((f, i) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Suggestions */}
                                {analysis.suggestions && (
                                    <div className="glass-card">
                                        <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FiCheckCircle style={{ color: 'var(--accent-success)' }} /> Suggestions</h3>
                                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{analysis.suggestions}</p>
                                    </div>
                                )}

                                {/* STAR Suggestions */}
                                {analysis.starSuggestions?.length > 0 && (
                                    <div className="glass-card">
                                        <h3 style={{ marginBottom: 12 }}>⭐ STAR Method Suggestions</h3>
                                        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2 }}>
                                            {analysis.starSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                                <p style={{ color: 'var(--text-muted)' }}>Paste your resume and job description to get ATS analysis</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* History Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {history.map((a) => (
                        <div key={a._id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => { setAnalysis(a); setTab('analyze'); }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Analysis #{a._id.slice(-6)}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FiClock /> {new Date(a.createdAt).toLocaleString()}
                                    {a.missingKeywords?.length > 0 && <span>• {a.missingKeywords.length} missing keywords</span>}
                                </div>
                            </div>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', border: `3px solid ${getScoreColor(a.matchScore)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: getScoreColor(a.matchScore) }}>
                                {a.matchScore}%
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <div className="empty-state"><div className="icon">📄</div><p>No analysis history yet</p></div>}
                </div>
            )}
        </div>
    );
};

export default ResumeAnalysis;
