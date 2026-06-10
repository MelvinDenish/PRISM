import { useState, useEffect } from 'react';
import { analyzeResume, getAnalysisHistory } from '../services/api';
import { FiUpload, FiTarget, FiAlertTriangle, FiCheckCircle, FiClock, FiSearch, FiFileText, FiStar } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import SegmentedControl from '../components/ui/SegmentedControl';
import AnimatedNumber from '../components/motion/AnimatedNumber';

const ResumeAnalysis = () => {
    const [resumeText, setResumeText] = useState('');
    const [resumeFile, setResumeFile] = useState(null); // PDF upload
    const [jobDescription, setJobDescription] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('analyze');
    const [error, setError] = useState('');

    useEffect(() => {
        getAnalysisHistory()
            .then((res) => setHistory(res.data.analyses || []))
            .catch(() => { });
    }, []);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        setError('');
        if (!jobDescription.trim()) { setError('Please paste the job description.'); return; }
        if (!resumeFile && !resumeText.trim()) { setError('Upload a PDF resume or paste your resume text.'); return; }
        setLoading(true);
        try {
            let res;
            if (resumeFile) {
                const fd = new FormData();
                fd.append('file', resumeFile);
                fd.append('jobDescription', jobDescription);
                res = await analyzeResume(fd);
            } else {
                res = await analyzeResume({ resumeText, jobDescription });
            }
            setAnalysis(res.data.analysis);
            if (res.data.mode === 'keyword') {
                setError('AI analysis was unavailable, so we used keyword matching. Results are an estimate.');
            }
            const hRes = await getAnalysisHistory();
            setHistory(hRes.data.analyses || []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Analysis failed. Please try again in a moment.');
        }
        setLoading(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type === 'application/pdf') {
            // Server extracts PDF text (keeps formatting fidelity for ATS).
            setResumeFile(file);
            setResumeText('');
        } else {
            // Plain-text resume — read inline.
            setResumeFile(null);
            setResumeText(await file.text());
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'var(--accent-success)';
        if (score >= 60) return 'var(--accent-warning)';
        return 'var(--accent-danger)';
    };

    return (
        <div className="page">
            <PageHero
                eyebrow="Career"
                title="Resume ATS Analysis"
                subtitle="Score your resume against a job description and close the gaps."
                icon={<FiTarget />}
                actions={
                    <SegmentedControl
                        id="ra-tab"
                        value={tab}
                        onChange={setTab}
                        options={[{ value: 'analyze', label: 'Analyze' }, { value: 'history', label: 'History', count: history.length }]}
                    />
                }
            />

            {tab === 'analyze' ? (
                <Reveal className="grid grid-2">
                    {/* Input Form */}
                    <div className="glass-card spotlight">
                        <h3 className="card-title" style={{ marginBottom: 20 }}><FiUpload /> Upload &amp; Analyze</h3>
                        <form onSubmit={handleAnalyze}>
                            <div className="form-group">
                                <label>Resume Content</label>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        <FiUpload /> Upload PDF / .txt
                                        <input type="file" accept=".pdf,.txt,.text" style={{ display: 'none' }} onChange={handleFileUpload} />
                                    </label>
                                    {resumeFile
                                        ? <span style={{ fontSize: 12, color: 'var(--accent-primary)', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiFileText /> {resumeFile.name} <button type="button" className="icon-btn" onClick={() => setResumeFile(null)} aria-label="Remove">×</button></span>
                                        : <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>or paste below</span>}
                                </div>
                                {resumeFile
                                    ? <div className="form-input" style={{ color: 'var(--text-muted)', minHeight: 60, display: 'flex', alignItems: 'center' }}>PDF will be read on the server — its text is extracted for analysis. Remove the file to paste text instead.</div>
                                    : <textarea className="form-textarea" value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume text here..." style={{ minHeight: 200 }} />}
                            </div>
                            <div className="form-group">
                                <label>Job Description</label>
                                <textarea className="form-textarea" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description you're targeting..." style={{ minHeight: 150 }} required />
                            </div>
                            <button className="btn btn-action btn-lg" style={{ width: '100%' }} disabled={loading}>
                                <FiSearch /> {loading ? 'Analyzing...' : 'Analyze Resume'}
                            </button>
                            {error && (
                                <div className="form-notice" role="alert" style={{ marginTop: 12 }}>
                                    <FiAlertTriangle /> {error}
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Results */}
                    <div>
                        {analysis ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Match Score */}
                                <Reveal as="div" i={0} className="glass-card spotlight" style={{ textAlign: 'center' }}>
                                    <h3 className="card-title" style={{ marginBottom: 16, justifyContent: 'center' }}><FiTarget /> ATS Match Score</h3>
                                    <div style={{ width: 120, height: 120, borderRadius: '50%', border: `4px solid ${getScoreColor(analysis.matchScore)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36, fontWeight: 800, color: getScoreColor(analysis.matchScore) }}>
                                        <AnimatedNumber value={analysis.matchScore} suffix="%" />
                                    </div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                        {analysis.matchScore >= 80 ? 'Great match!' : analysis.matchScore >= 60 ? 'Good, but can improve' : 'Needs significant improvement'}
                                    </p>
                                </Reveal>

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
                                        <h3 className="card-title" style={{ marginBottom: 12 }}><FiStar /> STAR Method Suggestions</h3>
                                        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2 }}>
                                            {analysis.starSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="glass-card" style={{ textAlign: 'center', padding: 60 }}>
                                <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--accent-primary)', display: 'flex', justifyContent: 'center' }}><FiFileText /></div>
                                <p style={{ color: 'var(--text-muted)' }}>Paste your resume and job description to get ATS analysis</p>
                            </div>
                        )}
                    </div>
                </Reveal>
            ) : (
                /* History Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {history.map((a, idx) => (
                        <Reveal as="div" key={a._id} i={idx} className="glass-card spotlight" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => { setAnalysis(a); setTab('analyze'); }}>
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
                        </Reveal>
                    ))}
                    {history.length === 0 && <div className="empty-state"><div className="icon"><FiFileText /></div><p>No analysis history yet</p></div>}
                </div>
            )}
        </div>
    );
};

export default ResumeAnalysis;
