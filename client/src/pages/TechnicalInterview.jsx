import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { getMockInterview, getCodingQuestions, submitCode, submitMockFeedback } from '../services/api';
import { FiPlay, FiSend, FiVideo, FiVideoOff, FiMic, FiMicOff, FiMessageSquare } from 'react-icons/fi';

const SOCKET_URL = 'http://localhost:5000';

const TechnicalInterview = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const [interview, setInterview] = useState(null);
    const [code, setCode] = useState('// Start coding here...\n\nconsole.log("Hello, World!");');
    const [language, setLanguage] = useState('javascript');
    const [output, setOutput] = useState('');
    const [questions, setQuestions] = useState([]);
    const [selectedQ, setSelectedQ] = useState(null);
    const [running, setRunning] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState('');
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const socketRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const isRemote = useRef(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [iRes, qRes] = await Promise.all([
                    getMockInterview(id),
                    getCodingQuestions()
                ]);
                setInterview(iRes.data.interview);
                setQuestions(qRes.data.questions || []);
            } catch (err) { console.error(err); }
        };
        fetchData();

        // Socket connection
        socketRef.current = io(SOCKET_URL);
        socketRef.current.emit('join-room', { roomId: id, userId: user._id, userName: user.name });

        socketRef.current.on('code-update', ({ code: newCode }) => {
            isRemote.current = true;
            setCode(newCode);
        });

        socketRef.current.on('room-participants', (p) => setParticipants(p));
        socketRef.current.on('receive-message', (msg) => setMessages((prev) => [...prev, msg]));
        socketRef.current.on('sync-code', ({ code: syncCode }) => { isRemote.current = true; setCode(syncCode); });

        return () => {
            socketRef.current?.emit('leave-room', { roomId: id });
            socketRef.current?.disconnect();
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [id]);

    const handleCodeChange = (value) => {
        if (isRemote.current) { isRemote.current = false; return; }
        setCode(value);
        socketRef.current?.emit('code-change', { roomId: id, code: value });
    };

    const runCode = async () => {
        setRunning(true);
        setOutput('Running...');
        try {
            const res = await submitCode({ mockInterview: id, question: selectedQ?._id, code, language });
            const sub = res.data.submission;
            setOutput(sub.error || sub.output || 'No output');
        } catch (err) {
            setOutput(`Error: ${err.message}`);
        }
        setRunning(false);
    };

    const sendChat = () => {
        if (!chatMsg.trim()) return;
        socketRef.current?.emit('send-message', { roomId: id, message: chatMsg, userName: user.name });
        setChatMsg('');
    };

    const toggleVideo = async () => {
        if (videoEnabled) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            setVideoEnabled(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: audioEnabled });
                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setVideoEnabled(true);
            } catch (err) { console.error('Camera error:', err); }
        }
    };

    const langMap = { javascript: 'javascript', python: 'python', java: 'java', cpp: 'cpp', c: 'c' };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Left sidebar - Question & Chat */}
            <div style={{ width: 320, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Question panel */}
                <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', flex: '0 0 auto' }}>
                    <h3 style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Question</h3>
                    {selectedQ ? (
                        <div>
                            <h4 style={{ fontSize: 16, marginBottom: 8 }}>{selectedQ.title}</h4>
                            <span className={`badge badge-${selectedQ.difficulty === 'easy' ? 'success' : selectedQ.difficulty === 'medium' ? 'warning' : 'danger'}`}>{selectedQ.difficulty}</span>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{selectedQ.description}</p>
                            {selectedQ.sampleInput && <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 6, fontSize: 12 }}><strong>Input:</strong> {selectedQ.sampleInput}</div>}
                            {selectedQ.sampleOutput && <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-input)', borderRadius: 6, fontSize: 12 }}><strong>Output:</strong> {selectedQ.sampleOutput}</div>}
                        </div>
                    ) : (
                        <div>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Select a question:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                                {questions.slice(0, 10).map((q) => (
                                    <button key={q._id} onClick={() => setSelectedQ(q)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                                        {q.title}
                                    </button>
                                ))}
                                {questions.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No questions available</p>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Participants */}
                <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', flex: '0 0 auto' }}>
                    <h3 style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Participants ({participants.length})</h3>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {participants.map((p, i) => (
                            <span key={i} className="chip">{p.userName}</span>
                        ))}
                    </div>
                </div>

                {/* Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ marginBottom: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent-primary)' }}>{m.userName}: </span>
                                <span style={{ fontSize: 13 }}>{m.message}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                        <input className="form-input" style={{ flex: 1, padding: '8px 12px' }} placeholder="Type message..." value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} />
                        <button className="btn btn-primary btn-sm" onClick={sendChat}><FiSend /></button>
                    </div>
                </div>
            </div>

            {/* Main editor area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <select className="form-select" style={{ width: 140, padding: '6px 10px' }} value={language} onChange={(e) => setLanguage(e.target.value)}>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                            <option value="c">C</option>
                        </select>
                        <button className="btn btn-success btn-sm" onClick={runCode} disabled={running}>
                            <FiPlay /> {running ? 'Running...' : 'Run Code'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={`btn btn-sm ${videoEnabled ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleVideo}>
                            {videoEnabled ? <FiVideoOff /> : <FiVideo />}
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
                        options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, padding: { top: 12 } }}
                    />
                </div>

                {/* Output */}
                <div style={{ height: 160, background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', overflow: 'auto' }}>
                    <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Output</div>
                    <pre style={{ padding: 16, fontSize: 13, fontFamily: 'monospace', color: output.startsWith('Error') ? 'var(--accent-danger)' : 'var(--accent-success)', whiteSpace: 'pre-wrap' }}>{output || 'Run your code to see output'}</pre>
                </div>
            </div>

            {/* Video panel */}
            {videoEnabled && (
                <div style={{ width: 240, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', padding: 12 }}>
                    <h4 style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>VIDEO</h4>
                    <video ref={localVideoRef} autoPlay muted style={{ width: '100%', borderRadius: 8, marginBottom: 8, background: '#000' }} />
                    <video ref={remoteVideoRef} autoPlay style={{ width: '100%', borderRadius: 8, background: '#000' }} />
                </div>
            )}
        </div>
    );
};

export default TechnicalInterview;
