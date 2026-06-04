import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { getCodingQuestions, submitCodeExecution, startAIInterview, chatAIInterview, evaluateAIInterview, runTestCases, runCustomCode } from '../services/api';
import { FiPlay, FiSend, FiVideo, FiVideoOff, FiMic, FiMicOff, FiMessageSquare, FiPhoneOff, FiMonitor, FiClock, FiCpu, FiUser, FiZap, FiHelpCircle, FiCheck, FiTerminal, FiCode } from 'react-icons/fi';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const LANGUAGES = [
    { id: 'javascript', name: 'JavaScript', monacoLang: 'javascript' },
    { id: 'python', name: 'Python 3', monacoLang: 'python' },
    { id: 'cpp', name: 'C++', monacoLang: 'cpp' },
    { id: 'java', name: 'Java', monacoLang: 'java' },
    { id: 'c', name: 'C', monacoLang: 'c' },
];

const TechnicalInterview = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Interview state
    const [interview, setInterview] = useState(null);
    const [mode, setMode] = useState('loading'); // 'loading' | 'mentor' | 'ai'
    const [code, setCode] = useState('// Start coding here...\n\nconsole.log("Hello, World!");');
    const [language, setLanguage] = useState('javascript');
    const [output, setOutput] = useState('');

    // Questions & coding
    const [questions, setQuestions] = useState([]);
    const [selectedQ, setSelectedQ] = useState(null);
    const [running, setRunning] = useState(false);
    const [testResults, setTestResults] = useState(null);
    const [runningTests, setRunningTests] = useState(false);
    const [customInput, setCustomInput] = useState('');
    const [customOutput, setCustomOutput] = useState('');
    const [runningCustom, setRunningCustom] = useState(false);
    const [activeTab, setActiveTab] = useState('question'); // question | testcases | results

    // Participants & chat
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState('');

    // Video call state
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [connected, setConnected] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    // AI Interviewer state
    const [aiMessages, setAiMessages] = useState([]);
    const [aiInput, setAiInput] = useState('');
    const [aiContext, setAiContext] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiEval, setAiEval] = useState(null);
    const [showAiChat, setShowAiChat] = useState(true);
    const [hintRequested, setHintRequested] = useState(false);

    // Refs
    const socketRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const isRemote = useRef(false);
    const timerRef = useRef(null);
    const chatEndRef = useRef(null);

    // ═══════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════
    useEffect(() => {
        const fetchData = async () => {
            try {
                const qRes = await getCodingQuestions();
                setQuestions(qRes.data.questions || []);
            } catch (err) { console.error(err); }
        };
        fetchData();

        // Socket connection (authenticated via JWT handshake)
        socketRef.current = io(SOCKET_URL, { auth: { token: localStorage.getItem('prism_token') } });
        socketRef.current.emit('join-room', { roomId: id });

        socketRef.current.on('code-update', ({ code: newCode }) => {
            isRemote.current = true;
            setCode(newCode);
        });

        socketRef.current.on('room-participants', (p) => {
            setParticipants(p);
            // Check if a mentor is in the room
            const hasMentor = p.some(pt => pt.userId !== user._id);
            if (hasMentor) {
                setMode('mentor');
            } else {
                // No mentor — start AI mode
                setMode('ai');
                initAIInterviewer();
            }
        });

        socketRef.current.on('receive-message', (msg) => setMessages((prev) => [...prev, msg]));
        socketRef.current.on('sync-code', ({ code: syncCode }) => { isRemote.current = true; setCode(syncCode); });

        // PeerJS signaling
        socketRef.current.on('peer-joined', ({ peerId, name }) => {
            if (streamRef.current && peerRef.current) {
                const call = peerRef.current.call(peerId, streamRef.current);
                call.on('stream', (remoteStream) => {
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                    setConnected(true);
                    setMode('mentor');
                });
            }
        });

        // Timer for session duration
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

        return () => {
            socketRef.current?.emit('leave-room', { roomId: id });
            socketRef.current?.disconnect();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            peerRef.current?.destroy();
            clearInterval(timerRef.current);
        };
    }, [id]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages, messages]);

    // ═══════════════════════════════════════════
    // AI INTERVIEWER FALLBACK
    // ═══════════════════════════════════════════
    const initAIInterviewer = async () => {
        setAiLoading(true);
        try {
            const { data } = await startAIInterview({ type: 'technical', topic: 'Data Structures and Algorithms' });
            setAiMessages([{ role: 'ai', content: data.aiMessage }]);
            setAiContext(data.conversationContext);
        } catch {
            setAiMessages([{ role: 'ai', content: "Welcome to the technical interview! I'll be your AI interviewer today. Let's start — can you tell me about a challenging technical problem you've solved recently?" }]);
        }
        setAiLoading(false);
    };

    const sendAiMessage = async () => {
        if (!aiInput.trim() || aiLoading) return;
        const msg = aiInput.trim();
        setAiInput('');
        setAiMessages(prev => [...prev, { role: 'user', content: msg }]);
        setAiLoading(true);
        try {
            const { data } = await chatAIInterview({ message: msg, conversationContext: aiContext });
            setAiMessages(prev => [...prev, { role: 'ai', content: data.aiMessage }]);
            setAiContext(data.updatedContext);
        } catch { setAiMessages(prev => [...prev, { role: 'ai', content: 'Could you elaborate on that?' }]); }
        setAiLoading(false);
    };

    // ═══════════════════════════════════════════
    // HINT SYSTEM — AI/Mentor helps when struggling
    // ═══════════════════════════════════════════
    const requestHint = async () => {
        if (!selectedQ || hintRequested) return;
        setHintRequested(true);

        if (mode === 'mentor') {
            // Send hint request to mentor via chat
            socketRef.current?.emit('send-message', {
                roomId: id,
                message: `💡 [HINT REQUEST] I'm struggling with "${selectedQ.title}". Can you help me with an approach?`,
                userName: user.name
            });
        } else {
            // AI provides hint
            setAiLoading(true);
            try {
                const hintPrompt = `The candidate is struggling with this coding problem:
Title: ${selectedQ.title}
Description: ${selectedQ.description || ''}
Their current code (${language}):
\`\`\`
${code}
\`\`\`
Give a helpful HINT — don't give the full solution. Suggest an approach, data structure, or algorithm. Keep it concise (2-3 sentences).`;

                const { data } = await chatAIInterview({
                    message: hintPrompt,
                    conversationContext: aiContext
                });
                setAiMessages(prev => [...prev, { role: 'ai', content: `💡 **Hint:** ${data.aiMessage}` }]);
                setAiContext(data.updatedContext);
            } catch {
                setAiMessages(prev => [...prev, { role: 'ai', content: '💡 Try breaking the problem into smaller parts. What data structure could help here?' }]);
            }
            setAiLoading(false);
        }
        setTimeout(() => setHintRequested(false), 15000); // Allow another hint after 15s
    };

    // ═══════════════════════════════════════════
    // CODE EXECUTION
    // ═══════════════════════════════════════════
    const handleCodeChange = (value) => {
        if (isRemote.current) { isRemote.current = false; return; }
        setCode(value);
        socketRef.current?.emit('code-change', { roomId: id, code: value });
    };

    const runCode = async () => {
        setRunning(true);
        setOutput('Running...');
        try {
            const res = await submitCodeExecution({ sourceCode: code, language, stdin: '' });
            setOutput(res.data.stderr || res.data.stdout || 'No output');
        } catch (err) {
            setOutput(`Error: ${err.message}`);
        }
        setRunning(false);
    };

    const handleRunTests = async () => {
        if (!selectedQ?.testCases?.length) return;
        setRunningTests(true);
        setActiveTab('results');
        try {
            const { data } = await runTestCases({
                sourceCode: code,
                language: language,
                testCases: selectedQ.testCases
            });
            setTestResults(data);
        } catch (err) {
            setTestResults({
                testResults: selectedQ.testCases.map((tc, i) => ({
                    testCase: i + 1, input: tc.input, expectedOutput: tc.expectedOutput,
                    actualOutput: '', passed: false, status: 'Error', error: err.message
                })),
                passedCount: 0, totalCount: selectedQ.testCases.length, score: 0
            });
        }
        setRunningTests(false);
    };

    const handleRunCustom = async () => {
        if (!code.trim()) return;
        setRunningCustom(true);
        try {
            const { data } = await runCustomCode({ sourceCode: code, language, stdin: customInput });
            setCustomOutput(data.output || data.error || 'No output');
        } catch (err) { setCustomOutput('Error: ' + (err.response?.data?.message || err.message)); }
        setRunningCustom(false);
    };

    // ═══════════════════════════════════════════
    // VIDEO CALL
    // ═══════════════════════════════════════════
    const toggleVideo = async () => {
        if (videoEnabled) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            setVideoEnabled(false);
            setConnected(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, frameRate: 15 }, // Low bandwidth: 240p
                    audio: audioEnabled
                });
                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                // Initialize PeerJS
                const peer = new Peer();
                peerRef.current = peer;

                peer.on('open', (peerId) => {
                    socketRef.current?.emit('session-peer-id', { sessionId: id, peerId });
                });

                peer.on('call', (call) => {
                    call.answer(stream);
                    call.on('stream', (remoteStream) => {
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                        setConnected(true);
                    });
                });

                setVideoEnabled(true);
            } catch (err) { console.error('Camera error:', err); }
        }
    };

    const toggleAudio = () => {
        const audio = streamRef.current?.getAudioTracks()[0];
        if (audio) { audio.enabled = !audio.enabled; setAudioEnabled(audio.enabled); }
    };

    // ═══════════════════════════════════════════
    // CHAT
    // ═══════════════════════════════════════════
    const sendChat = () => {
        if (!chatMsg.trim()) return;
        socketRef.current?.emit('send-message', { roomId: id, message: chatMsg, userName: user.name });
        setChatMsg('');
    };

    // ═══════════════════════════════════════════
    // EVALUATION
    // ═══════════════════════════════════════════
    const endInterview = async () => {
        setAiLoading(true);
        try {
            const context = mode === 'ai' ? aiContext : [
                { role: 'system', content: 'Evaluate based on coding performance in interview.' },
                { role: 'user', content: `Code submitted:\n${code}\nLanguage: ${language}\nTest results: ${JSON.stringify(testResults)}` }
            ];
            const { data } = await evaluateAIInterview({ conversationContext: context, type: 'technical' });
            setAiEval(data.evaluation);
        } catch {
            setAiEval({ overallScore: 0, detailedFeedback: 'Evaluation unavailable.', recommendation: 'N/A' });
        }
        setAiLoading(false);
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const langMap = { javascript: 'javascript', python: 'python', java: 'java', cpp: 'cpp', c: 'c' };

    // ═══════════════════════════════════════════
    // EVALUATION RESULTS VIEW
    // ═══════════════════════════════════════════
    if (aiEval) {
        const e = aiEval;
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
                                <div className="stat-value" style={{ color: score >= 70 ? 'var(--accent-success)' : score >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>{score || 'N/A'}</div>
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
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/sessions')}>← Back to Sessions</button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // MAIN INTERVIEW VIEW
    // ═══════════════════════════════════════════
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* ─── LEFT SIDEBAR: Question + AI/Chat ─── */}
            <div style={{ width: 360, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Mode indicator */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: mode === 'ai' ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {mode === 'ai' ? <FiCpu style={{ color: 'var(--accent-primary)' }} /> : <FiUser style={{ color: 'var(--accent-success)' }} />}
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{mode === 'ai' ? 'AI Interviewer' : 'Mentor Interview'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <FiClock /> {formatTime(elapsed)}
                    </div>
                </div>

                {/* Question panel */}
                <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', flex: '0 0 auto', maxHeight: 300, overflow: 'auto' }}>
                    <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Problem</h3>
                    {selectedQ ? (
                        <div>
                            <h4 style={{ fontSize: 15, marginBottom: 8 }}>{selectedQ.title}</h4>
                            <span className={`badge badge-${selectedQ.difficulty === 'easy' ? 'success' : selectedQ.difficulty === 'medium' ? 'warning' : 'danger'}`}>{selectedQ.difficulty}</span>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{selectedQ.description}</p>
                            {selectedQ.sampleInput && <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}><strong>Input:</strong> {selectedQ.sampleInput}</div>}
                            {selectedQ.sampleOutput && <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-input)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}><strong>Output:</strong> {selectedQ.sampleOutput}</div>}
                            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, fontSize: 11 }} onClick={() => setSelectedQ(null)}>← Change Problem</button>
                        </div>
                    ) : (
                        <div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Select a coding problem:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                                {questions.slice(0, 10).map((q) => (
                                    <button key={q._id} onClick={() => setSelectedQ(q)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
                                        <div style={{ fontWeight: 600 }}>{q.title}</div>
                                        <span className={`badge badge-${q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'danger'}`} style={{ fontSize: 10, marginTop: 4 }}>{q.difficulty}</span>
                                    </button>
                                ))}
                                {questions.length === 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No questions available</p>}
                            </div>
                        </div>
                    )}
                </div>

                {/* AI Interview Chat / Mentor Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Tab toggle */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                        <button className={`tab ${showAiChat ? 'active' : ''}`} onClick={() => setShowAiChat(true)} style={{ flex: 1, fontSize: 12 }}>
                            {mode === 'ai' ? '🤖 AI Interviewer' : '💬 Chat'}
                        </button>
                        <button className={`tab ${!showAiChat ? 'active' : ''}`} onClick={() => setShowAiChat(false)} style={{ flex: 1, fontSize: 12 }}>
                            👥 Participants ({participants.length})
                        </button>
                    </div>

                    {showAiChat ? (
                        /* Chat/AI messages */
                        <>
                            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                                {mode === 'ai' ? (
                                    aiMessages.map((msg, i) => (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                {msg.role === 'ai' ? <><FiCpu /> AI Interviewer</> : <><FiUser /> You</>}
                                            </div>
                                            <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.6, background: msg.role === 'ai' ? 'var(--bg-input)' : 'rgba(99,102,241,0.1)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                        </div>
                                    ))
                                ) : (
                                    messages.map((m, i) => (
                                        <div key={i} style={{ marginBottom: 8 }}>
                                            <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent-primary)' }}>{m.userName}: </span>
                                            <span style={{ fontSize: 13 }}>{m.message}</span>
                                        </div>
                                    ))
                                )}
                                {aiLoading && <div style={{ padding: 8 }}><div className="spinner" style={{ width: 18, height: 18, margin: 0 }} /></div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 6 }}>
                                {mode === 'ai' ? (
                                    <>
                                        <input className="form-input" style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} placeholder="Answer the interviewer..."
                                            value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendAiMessage()} />
                                        <button className="btn btn-primary btn-sm" onClick={sendAiMessage} disabled={aiLoading}><FiSend /></button>
                                    </>
                                ) : (
                                    <>
                                        <input className="form-input" style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} placeholder="Message mentor..."
                                            value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} />
                                        <button className="btn btn-primary btn-sm" onClick={sendChat}><FiSend /></button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Participants list */
                        <div style={{ padding: 12 }}>
                            {participants.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No other participants yet</p>}
                            {participants.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.userId === user._id ? 'var(--gradient-primary)' : 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
                                        {(p.userName || '?')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.userName}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.userId === user._id ? 'You' : 'Mentor/Peer'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── MAIN AREA: Code Editor + Output ─── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '6px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select className="form-select" style={{ width: 130, padding: '5px 8px', fontSize: 12 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
                            {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <button className="btn btn-success btn-sm" onClick={runCode} disabled={running}>
                            <FiPlay /> {running ? 'Running...' : 'Run'}
                        </button>
                        {selectedQ?.testCases?.length > 0 && (
                            <button className="btn btn-secondary btn-sm" onClick={handleRunTests} disabled={runningTests}>
                                <FiTerminal /> {runningTests ? 'Testing...' : 'Run Tests'}
                            </button>
                        )}
                        <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-warning)', border: '1px solid rgba(245,158,11,0.3)' }}
                            onClick={requestHint} disabled={hintRequested || !selectedQ}>
                            <FiHelpCircle /> {hintRequested ? 'Hint sent...' : 'Get Hint'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className={`btn btn-sm ${videoEnabled ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleVideo}>
                            {videoEnabled ? <FiVideoOff /> : <FiVideo />}
                        </button>
                        <button className={`btn btn-sm ${!audioEnabled ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleAudio}>
                            {audioEnabled ? <FiMic /> : <FiMicOff />}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={endInterview}>
                            <FiCheck /> End & Evaluate
                        </button>
                    </div>
                </div>

                {/* Editor */}
                <div style={{ flex: 1 }}>
                    <Editor
                        height="100%"
                        language={langMap[language] || 'javascript'}
                        value={code}
                        onChange={handleCodeChange}
                        theme="vs-dark"
                        options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, padding: { top: 12 }, tabSize: 4, wordWrap: 'on' }}
                    />
                </div>

                {/* Output + Test Results Panel */}
                <div style={{ height: 200, background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                        {['output', 'testcases', 'results', 'custom'].map(tab => (
                            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}
                                style={{ fontSize: 11, textTransform: 'capitalize', padding: '6px 14px' }}>
                                {tab === 'results' && testResults ? `Results (${testResults.passedCount}/${testResults.totalCount})` : tab === 'custom' ? 'Custom I/O' : tab}
                            </button>
                        ))}
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                        {activeTab === 'output' && (
                            <pre style={{ fontSize: 12, fontFamily: 'monospace', color: output.startsWith('Error') ? 'var(--accent-danger)' : 'var(--accent-success)', whiteSpace: 'pre-wrap', margin: 0 }}>{output || 'Run your code to see output'}</pre>
                        )}
                        {activeTab === 'testcases' && selectedQ?.testCases && (
                            <div>
                                {selectedQ.testCases.map((tc, i) => (
                                    <div key={i} style={{ marginBottom: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}>
                                        <span className="badge badge-info" style={{ fontSize: 10, marginBottom: 4 }}>Case {i + 1}</span>
                                        <div><strong>Input:</strong> <code>{tc.input}</code></div>
                                        <div><strong>Expected:</strong> <code style={{ color: 'var(--accent-success)' }}>{tc.expectedOutput}</code></div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'results' && testResults && (
                            <div>
                                <div style={{ marginBottom: 8 }}>
                                    <span className={`badge ${testResults.score >= 60 ? 'badge-success' : 'badge-danger'}`}>Score: {testResults.score}% — {testResults.passedCount}/{testResults.totalCount} passed</span>
                                </div>
                                {testResults.testResults?.map((tr, i) => (
                                    <div key={i} style={{ marginBottom: 6, padding: 6, borderRadius: 4, fontSize: 11, fontFamily: 'monospace', background: tr.passed ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${tr.passed ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                                        <span>{tr.passed ? '✅' : '❌'} Case {tr.testCase}: </span>
                                        <span style={{ color: 'var(--text-muted)' }}>Expected={tr.expectedOutput} Got={tr.actualOutput || 'N/A'}</span>
                                        {tr.error && <span style={{ color: 'var(--accent-danger)' }}> — {tr.error}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'custom' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '100%' }}>
                                <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Custom Input (stdin)</label>
                                    <textarea className="form-textarea" rows={4} value={customInput} onChange={e => setCustomInput(e.target.value)}
                                        placeholder="Enter input..." style={{ fontSize: 11, fontFamily: 'monospace' }} />
                                    <button className="btn btn-sm btn-secondary" onClick={handleRunCustom} disabled={runningCustom} style={{ marginTop: 4 }}>
                                        <FiPlay /> {runningCustom ? 'Running...' : 'Run'}
                                    </button>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Output</label>
                                    <pre style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', minHeight: 80, margin: 0, border: '1px solid var(--border-color)', color: customOutput.startsWith('Error') ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{customOutput || 'Output here...'}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── RIGHT PANEL: Video ─── */}
            {videoEnabled && (
                <div style={{ width: 260, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: 12 }}>
                    <h4 style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiVideo /> Video Call
                        <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 9, marginLeft: 'auto' }}>
                            {connected ? 'Connected' : 'Waiting'}
                        </span>
                    </h4>
                    <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 8, marginBottom: 8, background: '#000', aspectRatio: '4/3' }} />
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000', aspectRatio: '4/3', transform: 'scaleX(-1)' }} />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>240p • Low bandwidth mode</div>
                </div>
            )}
        </div>
    );
};

export default TechnicalInterview;
