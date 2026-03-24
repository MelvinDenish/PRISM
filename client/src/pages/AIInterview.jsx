import { useState, useRef, useEffect } from 'react';
import { startAIInterview, chatAIInterview, evaluateAIInterview } from '../services/api';
import { FiSend, FiMic, FiAward, FiRefreshCw, FiUser, FiCpu } from 'react-icons/fi';

const AIInterview = () => {
    const [phase, setPhase] = useState('setup');
    const [type, setType] = useState('technical');
    const [topic, setTopic] = useState('Data Structures');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [context, setContext] = useState([]);
    const [loading, setLoading] = useState(false);
    const [evaluation, setEvaluation] = useState(null);
    const [questionCount, setQuestionCount] = useState(0);
    const chatEndRef = useRef(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const startInterview = async () => {
        setLoading(true);
        try {
            const { data } = await startAIInterview({ type, topic });
            setMessages([{ role: 'ai', content: data.aiMessage }]);
            setContext(data.conversationContext);
            setQuestionCount(1);
            setPhase('interview');
        } catch (err) {
            setMessages([{ role: 'ai', content: 'Could not start interview. Please check your GROQ_API_KEY in server .env' }]);
            setPhase('interview');
        }
        setLoading(false);
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { data } = await chatAIInterview({ message: userMsg, conversationContext: context });
            setMessages(prev => [...prev, { role: 'ai', content: data.aiMessage }]);
            setContext(data.updatedContext);
            setQuestionCount(prev => prev + 1);
        } catch {
            setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, something went wrong. Please try again.' }]);
        }
        setLoading(false);
    };

    const endInterview = async () => {
        setLoading(true);
        try {
            const { data } = await evaluateAIInterview({ conversationContext: context, type });
            setEvaluation(data.evaluation);
            setPhase('results');
        } catch {
            setEvaluation({ overallScore: 0, detailedFeedback: 'Could not generate evaluation.', recommendation: 'N/A' });
            setPhase('results');
        }
        setLoading(false);
    };

    const reset = () => { setPhase('setup'); setMessages([]); setContext([]); setEvaluation(null); setQuestionCount(0); };

    if (phase === 'setup') {
        return (
            <div className="page">
                <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
                    <h1 className="page-title" style={{ fontSize: 32, marginBottom: 8 }}><span>AI Interviewer</span></h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>Practice with an AI that simulates a real interviewer. Get real-time feedback.</p>
                    <div className="glass-card" style={{ textAlign: 'left' }}>
                        <div className="form-group">
                            <label>Interview Type</label>
                            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                                <option value="technical">Technical Interview</option>
                                <option value="hr">HR Interview</option>
                                <option value="system-design">System Design</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Focus Topic</label>
                            <select className="form-select" value={topic} onChange={e => setTopic(e.target.value)}>
                                <option>Data Structures</option>
                                <option>Algorithms</option>
                                <option>DBMS</option>
                                <option>Operating Systems</option>
                                <option>Computer Networks</option>
                                <option>OOP & Design Patterns</option>
                                <option>System Design</option>
                                <option>Web Development</option>
                                <option>General</option>
                            </select>
                        </div>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={startInterview} disabled={loading}>
                            {loading ? 'Starting...' : '🎙️ Start Interview'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'results') {
        const e = evaluation || {};
        return (
            <div className="page">
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
                        <h1 className="page-title"><span>Interview Evaluation</span></h1>
                    </div>
                    <div className="grid grid-4" style={{ marginBottom: 32 }}>
                        {[['Overall', e.overallScore], ['Technical', e.technicalSkill], ['Communication', e.communication], ['Problem Solving', e.problemSolving]].map(([label, score]) => (
                            <div key={label} className="stat-card" style={{ textAlign: 'center' }}>
                                <div className="stat-label" style={{ justifyContent: 'center' }}>{label}</div>
                                <div className="stat-value">{score || 'N/A'}</div>
                            </div>
                        ))}
                    </div>
                    <div className="glass-card" style={{ marginBottom: 20 }}>
                        <span className={`badge ${e.recommendation?.includes('Hire') && !e.recommendation?.includes('No') ? 'badge-success' : 'badge-warning'}`} style={{ marginBottom: 16 }}>
                            {e.recommendation || 'Review'}
                        </span>
                        <h3 style={{ marginBottom: 12 }}>Detailed Feedback</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{e.detailedFeedback}</p>
                    </div>
                    {e.strengths && (
                        <div className="grid grid-2" style={{ marginBottom: 20 }}>
                            <div className="glass-card">
                                <h4 style={{ color: 'var(--accent-success)', marginBottom: 12 }}>✅ Strengths</h4>
                                {e.strengths.map((s, i) => <p key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>• {s}</p>)}
                            </div>
                            <div className="glass-card">
                                <h4 style={{ color: 'var(--accent-warning)', marginBottom: 12 }}>⚠️ Improvements</h4>
                                {(e.improvements || []).map((s, i) => <p key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>• {s}</p>)}
                            </div>
                        </div>
                    )}
                    <button className="btn btn-primary btn-lg" onClick={reset}><FiRefreshCw /> New Interview</button>
                </div>
            </div>
        );
    }

    return (
        <div className="ai-chat-container" style={{ padding: '0 24px' }}>
            <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                    <h3 style={{ fontSize: 16 }}>🤖 AI {type.charAt(0).toUpperCase() + type.slice(1)} Interview</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Questions asked: {questionCount} • Topic: {topic}</p>
                </div>
                <button className="btn btn-danger" onClick={endInterview} disabled={loading}>End & Evaluate</button>
            </div>
            <div className="chat-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role === 'ai' ? 'ai' : 'user'}`}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {msg.role === 'ai' ? <><FiCpu /> AI Interviewer</> : <><FiUser /> You</>}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    </div>
                ))}
                {loading && <div className="chat-bubble ai"><div className="spinner" style={{ width: 20, height: 20, margin: 0 }} /></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="chat-input-bar">
                <input className="form-input" placeholder="Type your response..." value={input}
                    onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}><FiSend /></button>
            </div>
        </div>
    );
};

export default AIInterview;
