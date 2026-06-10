import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startInterviewGame, getGameQuestions, submitGameRound, startAIInterview, chatAIInterview, evaluateAIInterview, runTestCases, runCustomCode, startGroupDiscussion, respondGroupDiscussion, evaluateGroupDiscussion, getLeaderboard, getGameHistory } from '../services/api';
import { FiPlay, FiClock, FiAward, FiCheck, FiArrowRight, FiRotateCcw, FiSend, FiCpu, FiUser, FiAlertTriangle, FiMapPin, FiCode, FiTerminal } from 'react-icons/fi';
import Editor from '@monaco-editor/react';

const ROUNDS = [
    { type: 'aptitude', name: 'Aptitude Test', icon: '🧠', desc: '15 MCQ questions — quantitative, logical, verbal', time: 1200, passScore: 40 },
    { type: 'technical1', name: 'Technical Round 1', icon: '💻', desc: '10 MCQ questions — CS fundamentals', time: 900, passScore: 50 },
    { type: 'coding', name: 'Coding Round', icon: '⌨️', desc: '2 coding problems — solve within time', time: 2400, passScore: 30 },
    { type: 'gd', name: 'Group Discussion', icon: '🗣️', desc: 'AI-moderated topic discussion', time: 600, passScore: 40 },
    { type: 'technical2', name: 'Technical Round 2 (Live)', icon: '🔧', desc: 'Live interview with AI interviewer', time: 900, passScore: 50 },
    { type: 'hr', name: 'HR Round', icon: '👔', desc: '10 behavioral questions', time: 900, passScore: 40 },
];

const LANGUAGES = [
    { id: 'javascript', name: 'JavaScript', monacoLang: 'javascript' },
    { id: 'python', name: 'Python 3', monacoLang: 'python' },
    { id: 'cpp', name: 'C++', monacoLang: 'cpp' },
    { id: 'java', name: 'Java', monacoLang: 'java' },
    { id: 'c', name: 'C', monacoLang: 'c' },
];

const InterviewGame = () => {
    const [game, setGame] = useState(null);
    const [currentRound, setCurrentRound] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timer, setTimer] = useState(0);
    const [phase, setPhase] = useState('menu');
    const [roundScore, setRoundScore] = useState(null);
    const [mode, setMode] = useState('full');
    const [singleRound, setSingleRound] = useState(null);
    const [failSuggestions, setFailSuggestions] = useState(null);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [menuTab, setMenuTab] = useState('play'); // play | leaderboard | history
    const [leaderboard, setLeaderboard] = useState([]);
    const [history, setHistory] = useState([]);
    const [lbLoading, setLbLoading] = useState(false);

    // Coding round state
    const [selectedLang, setSelectedLang] = useState('python');
    const [codeByProblem, setCodeByProblem] = useState({});
    const [testResults, setTestResults] = useState({});
    const [runningTests, setRunningTests] = useState(false);
    const [activeTab, setActiveTab] = useState('description'); // description | testcases | results

    // GD (live multi-participant)
    const [gdMessages, setGdMessages] = useState([]);
    const [gdInput, setGdInput] = useState('');
    const [gdParticipants, setGdParticipants] = useState([]);
    const [gdTopic, setGdTopic] = useState('');
    const [gdContext, setGdContext] = useState([]);
    const [gdLoading, setGdLoading] = useState(false);
    const [gdEval, setGdEval] = useState(null);
    const [gdUserCount, setGdUserCount] = useState(0);
    // HR
    const [hrResponse, setHrResponse] = useState('');
    const [hrAnswers, setHrAnswers] = useState([]);
    // Coding custom input
    const [customInput, setCustomInput] = useState('');
    const [customOutput, setCustomOutput] = useState('');
    const [runningCustom, setRunningCustom] = useState(false);

    // AI Interview
    const [aiMessages, setAiMessages] = useState([]);
    const [aiInput, setAiInput] = useState('');
    const [aiContext, setAiContext] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiEval, setAiEval] = useState(null);

    const timerRef = useRef(null);
    const chatEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => { return () => clearInterval(timerRef.current); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);

    useEffect(() => {
        if (phase === 'playing' && timer > 0) {
            timerRef.current = setInterval(() => setTimer(t => {
                if (t <= 1) { clearInterval(timerRef.current); handleSubmitRound(); return 0; }
                return t - 1;
            }), 1000);
            return () => clearInterval(timerRef.current);
        }
    }, [phase]);

    // Initialize boilerplate when questions loaded (for coding)
    useEffect(() => {
        if (questions.length > 0 && ROUNDS[currentRound]?.type === 'coding') {
            const initial = {};
            questions.forEach(q => {
                if (q.boilerplate) initial[q.id] = q.boilerplate[selectedLang] || '';
            });
            setCodeByProblem(initial);
        }
    }, [questions, selectedLang]);

    const startGame = async (gameMode, selectedRoundIdx = null) => {
        setMode(gameMode);
        setSingleRound(selectedRoundIdx);
        setFailSuggestions(null);
        setAiEval(null);
        try {
            const { data } = await startInterviewGame({ difficulty: 'medium' });
            setGame(data.game);
            setCurrentRound(gameMode === 'single' && selectedRoundIdx !== null ? selectedRoundIdx : 0);
            setPhase('round-intro');
        } catch (err) { console.error(err); }
    };

    const startRound = async () => {
        const round = ROUNDS[currentRound];
        setAiMessages([]); setAiContext([]); setAiEval(null);
        setTestResults({}); setRunningTests(false); setActiveTab('description');
        setLoadingQuestions(true);

        if (round.type === 'technical2') {
            setAiLoading(true);
            try {
                const { data } = await startAIInterview({ type: 'technical', topic: 'Data Structures and Algorithms' });
                setAiMessages([{ role: 'ai', content: data.aiMessage }]);
                setAiContext(data.conversationContext);
            } catch { setAiMessages([{ role: 'ai', content: 'Technical interview started. Tell me about your understanding of data structures.' }]); }
            setAiLoading(false);
            setLoadingQuestions(false);
            setTimer(round.time);
            setPhase('playing');
            return;
        }

        // GD: use dedicated group discussion API
        if (round.type === 'gd') {
            try {
                const { data } = await startGroupDiscussion();
                setGdTopic(data.topic);
                setGdParticipants(data.participants);
                setGdMessages(data.discussion || []);
                setGdContext(data.context);
                setGdUserCount(0);
                setGdEval(null);
                setGdInput('');
            } catch (err) {
                console.error(err);
                setGdTopic('Should AI replace human interviews?');
                setGdParticipants([]);
                setGdMessages([]);
            }
            setLoadingQuestions(false);
            setTimer(round.time);
            setPhase('playing');
            return;
        }

        try {
            const { data } = await getGameQuestions(round.type, game._id);
            setQuestions(data.questions || []);
            setCurrentQ(0);
            setAnswers([]);
            setTimer(round.time);
            setRoundScore(null);
            setHrResponse('');
            setHrAnswers([]);
            setLoadingQuestions(false);
            setPhase('playing');
        } catch (err) { console.error(err); setLoadingQuestions(false); }
    };

    // GD: Send user message, get AI participant responses
    const handleGdSend = async () => {
        if (!gdInput.trim() || gdLoading) return;
        const msg = gdInput.trim();
        setGdInput('');
        setGdMessages(prev => [...prev, { speaker: 'You', message: msg }]);
        setGdUserCount(prev => prev + 1);
        setGdLoading(true);
        try {
            const { data } = await respondGroupDiscussion({
                userMessage: msg, context: gdContext, participants: gdParticipants, topic: gdTopic
            });
            setGdMessages(prev => [...prev, ...(data.responses || [])]);
            setGdContext(data.context);
        } catch {
            setGdMessages(prev => [...prev, { speaker: gdParticipants[0]?.name || 'AI', message: "That's an interesting perspective. Could you elaborate?" }]);
        }
        setGdLoading(false);
    };

    // Coding: Run with custom input
    const handleRunCustom = async (problemId) => {
        const code = codeByProblem[problemId] || '';
        if (!code.trim()) return;
        setRunningCustom(true);
        try {
            const { data } = await runCustomCode({ sourceCode: code, language: selectedLang, stdin: customInput });
            setCustomOutput(data.output || data.error || 'No output');
        } catch (err) {
            setCustomOutput('Error: ' + (err.response?.data?.message || err.message));
        }
        setRunningCustom(false);
    };

    const selectAnswer = (questionId, question, answer, correctAns) => {
        setAnswers(prev => {
            const exists = prev.findIndex(a => a.questionId === questionId);
            const entry = { questionId, question, selectedAnswer: answer, isCorrect: answer === correctAns };
            if (exists >= 0) { const n = [...prev]; n[exists] = entry; return n; }
            return [...prev, entry];
        });
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

    // ─── CODING: Run test cases via Piston API ───
    const handleRunTests = async (problemId) => {
        const problem = questions.find(q => q.id === problemId);
        if (!problem) return;
        const code = codeByProblem[problemId] || '';
        if (!code.trim()) return;

        setRunningTests(true);
        setActiveTab('results');
        try {
            const { data } = await runTestCases({
                sourceCode: code,
                language: selectedLang,
                testCases: problem.testCases
            });
            setTestResults(prev => ({ ...prev, [problemId]: data }));
        } catch (err) {
            const simResults = problem.testCases.map((tc, i) => ({
                testCase: i + 1,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput: '',
                passed: false,
                status: 'Execution Error',
                error: err.response?.data?.message || 'Code execution service unavailable'
            }));
            setTestResults(prev => ({ ...prev, [problemId]: { testResults: simResults, passedCount: 0, totalCount: problem.testCases.length, score: 0 } }));
        }
        setRunningTests(false);
    };

    const handleSubmitRound = async () => {
        clearInterval(timerRef.current);
        const round = ROUNDS[currentRound];
        let submitAnswers = answers;
        let aiScore = undefined;

        // MCQ rounds: compute score from isCorrect flags
        if (['aptitude', 'technical1'].includes(round.type) && answers.length > 0) {
            const correct = answers.filter(a => a.isCorrect).length;
            aiScore = Math.round((correct / questions.length) * 100);
        }

        if (round.type === 'technical2') {
            setAiLoading(true);
            try {
                const { data } = await evaluateAIInterview({ conversationContext: aiContext, type: 'technical' });
                setAiEval(data.evaluation);
                aiScore = data.evaluation?.overallScore || 50;
            } catch { aiScore = 50; }
            setAiLoading(false);
            submitAnswers = [];
        }

        if (round.type === 'coding') {
            const scores = questions.map(q => testResults[q.id]?.score || 0);
            aiScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
            submitAnswers = questions.map(q => ({
                problemId: q.id,
                language: selectedLang,
                code: codeByProblem[q.id] || '',
                passed: (testResults[q.id]?.score || 0) >= 60
            }));
        }

        if (round.type === 'gd') {
            setGdLoading(true);
            try {
                const { data } = await evaluateGroupDiscussion({ context: gdContext, topic: gdTopic });
                setGdEval(data.evaluation);
                aiScore = data.evaluation?.overallScore || 50;
            } catch { aiScore = Math.min(100, Math.max(20, gdUserCount * 15)); }
            setGdLoading(false);
            submitAnswers = [{ contributions: gdUserCount, topic: gdTopic }];
        }
        if (round.type === 'hr') {
            submitAnswers = hrAnswers;
            // Use AI to evaluate HR answers quality instead of length-based scoring
            try {
                const hrConversation = hrAnswers.map(a => [
                    { role: 'assistant', content: a.questionId },
                    { role: 'user', content: a.response || 'No response' }
                ]).flat();
                const { data } = await evaluateAIInterview({
                    conversationContext: [
                        { role: 'system', content: 'You are an HR interviewer evaluating behavioral responses.' },
                        ...hrConversation
                    ],
                    type: 'hr'
                });
                aiScore = data.evaluation?.overallScore || 60;
                setAiEval(data.evaluation);
            } catch {
                // Fallback: score based on answer completeness (not just length)
                const answeredCount = hrAnswers.filter(a => a.response && a.response.length > 30).length;
                aiScore = Math.min(100, Math.max(20, Math.round((answeredCount / Math.max(hrAnswers.length, 1)) * 85)));
            }
        }

        try {
            // For coding, send the primary problem's code so the SERVER can grade
            // it against hidden test cases (authoritative — aiScore is ignored there).
            const codingExtra = round.type === 'coding'
                ? { code: codeByProblem[questions[0]?.id] || '', language: selectedLang }
                : {};
            const { data } = await submitGameRound({ gameId: game._id, roundIndex: currentRound, answers: submitAnswers, aiScore, ...codingExtra });
            setGame(data.game);
            setRoundScore(data.roundScore);

            // Honest pass/fail in BOTH modes — practice no longer always says "Passed!"
            // (bug R2). In full mode a fail also eliminates; in practice it just shows
            // the fail screen with study suggestions and a retry.
            if (data.roundScore < ROUNDS[currentRound].passScore) {
                setPhase('failed');
                generateFailSuggestions(ROUNDS[currentRound], data.roundScore);
            } else {
                setPhase('round-result');
            }
        } catch (err) { console.error(err); setPhase('round-result'); setRoundScore(0); }
    };

    const generateFailSuggestions = (round, score) => {
        const topicMap = {
            aptitude: ['Aptitude & Reasoning'],
            technical1: ['Data Structures & Algorithms', 'Object-Oriented Programming', 'Database Management Systems'],
            technical2: ['Data Structures & Algorithms', 'System Design'],
            coding: ['Data Structures & Algorithms', 'Python Programming', 'Java Programming'],
            gd: ['Aptitude & Reasoning'],
            hr: ['Aptitude & Reasoning']
        };
        const tips = {
            aptitude: ['Practice quantitative aptitude daily', 'Learn shortcut methods', 'Take timed mock tests'],
            coding: ['Solve 2-3 problems daily', 'Focus on understanding patterns', 'Practice writing optimized code'],
            technical1: ['Revise core CS fundamentals', 'Practice coding problems', 'Study common interview patterns'],
            technical2: ['Revise core CS fundamentals', 'Practice coding problems', 'Study common interview patterns'],
            gd: ['Practice structuring arguments', 'Read current affairs', 'Practice speaking on random topics'],
            hr: ['Prepare STAR method answers', 'Practice introducing yourself', 'Research common HR questions']
        };
        setFailSuggestions({
            round: round.name, score, passScore: round.passScore,
            topics: (topicMap[round.type] || []).map(t => ({ name: t, reason: `Score of ${score}% in ${round.name} indicates gaps in ${t}.` })),
            tips: tips[round.type] || []
        });
    };

    const nextRound = () => {
        if (mode === 'single' || currentRound >= ROUNDS.length - 1) { setPhase('final'); return; }
        setCurrentRound(prev => prev + 1);
        setPhase('round-intro');
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const timerClass = timer < 60 ? 'danger' : timer < 180 ? 'warning' : '';

    // ═══════════════════════════════════════════
    //  MENU
    // ═══════════════════════════════════════════
    if (phase === 'menu') {
        const loadLeaderboard = async () => { if (leaderboard.length) return; setLbLoading(true); try { const { data } = await getLeaderboard(); setLeaderboard(data.leaderboard || []); } catch {} setLbLoading(false); };
        const loadHistory = async () => { if (history.length) return; setLbLoading(true); try { const { data } = await getGameHistory(); setHistory(data.games || []); } catch {} setLbLoading(false); };

        return (
            <div className="page">
                <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 32 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 76, height: 76, margin: '0 auto 18px', borderRadius: 22, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 34, boxShadow: 'var(--shadow-glow)' }}><FiAward /></div>
                        <h1 className="page-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 8 }}><span>Interview Simulator</span></h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 24, lineHeight: 1.8 }}>
                            Experience a realistic placement interview. Play the full game or practice individual rounds.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(20,20,24,0.03)', borderRadius: 12, padding: 4 }}>
                        {[['play', '🎮 Play'], ['leaderboard', '🏆 Leaderboard'], ['history', '📊 My History']].map(([key, label]) => (
                            <button key={key} onClick={() => { setMenuTab(key); if (key === 'leaderboard') loadLeaderboard(); if (key === 'history') loadHistory(); }}
                                style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                                    background: menuTab === key ? 'var(--accent-primary)' : 'transparent',
                                    color: menuTab === key ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Play Tab */}
                    {menuTab === 'play' && (
                        <>
                            <div className="glass-card" style={{ padding: 32, marginBottom: 32, textAlign: 'center' }}>
                                <h2 style={{ marginBottom: 8 }}>🏆 Full Interview Game</h2>
                                <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
                                    6 sequential rounds — just like a real placement drive. Score below the cutoff and you're eliminated!
                                </p>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
                                    {ROUNDS.map((r, i) => (<span key={r.type} className="badge badge-info" style={{ fontSize: 12 }}>{i + 1}. {r.name}</span>))}
                                </div>
                                <button className="btn btn-primary btn-lg" onClick={() => startGame('full')}><FiPlay /> Start Full Interview</button>
                            </div>
                            <h3 style={{ marginBottom: 16 }}>🎯 Practice Individual Rounds</h3>
                            <div className="grid grid-3">
                                {ROUNDS.map((r, i) => (
                                    <div key={r.type} className="glass-card" style={{ padding: 20, cursor: 'pointer' }} onClick={() => startGame('single', i)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                            <div style={{ fontSize: 28 }}>{r.icon}</div>
                                            <div><h4 style={{ fontSize: 14 }}>{r.name}</h4><p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.desc}</p></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                                            <span>⏱ {Math.floor(r.time / 60)} min</span>
                                            <span>Pass: {r.passScore}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Leaderboard Tab */}
                    {menuTab === 'leaderboard' && (
                        <div className="glass-card" style={{ padding: 24 }}>
                            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>🏆 Top Performers</h3>
                            {lbLoading ? <div className="spinner" /> : leaderboard.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No completed games yet. Be the first!</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Rank</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Name</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Best Score</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Games</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Avg</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((p, i) => (
                                            <tr key={p._id} style={{ borderBottom: '1px solid rgba(20,20,24,0.03)' }}>
                                                <td style={{ padding: '10px 12px', fontWeight: 700, color: i < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][i] : 'var(--text-primary)' }}>
                                                    {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                                                </td>
                                                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.name}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{p.bestPercent}%</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>({p.bestScore}/{p.maxPossible || 600})</span>
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.gamesPlayed}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.avgScore}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* History Tab */}
                    {menuTab === 'history' && (
                        <div>
                            {lbLoading ? <div className="spinner" /> : history.length === 0 ? (
                                <div className="glass-card" style={{ textAlign: 'center', padding: 40 }}>
                                    <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                                    <p style={{ color: 'var(--text-muted)' }}>No games played yet. Start your first interview!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {history.map(g => (
                                        <div key={g._id} className="glass-card" style={{ padding: 20 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: 16 }}>
                                                        {Math.round((g.totalScore / (g.maxTotalScore || 600)) * 100)}%
                                                    </span>
                                                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>{g.totalScore}/{g.maxTotalScore || 600}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span className={`badge ${g.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>{g.status}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(g.startedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {g.rounds?.map((r, i) => (
                                                    <div key={i} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                                        background: r.status === 'completed' ? (r.score >= (ROUNDS[i]?.passScore || 40) ? 'rgba(201,162,75,0.15)' : 'rgba(192,70,43,0.15)') : 'rgba(20,20,24,0.04)',
                                                        color: r.status === 'completed' ? (r.score >= (ROUNDS[i]?.passScore || 40) ? 'var(--accent-success)' : 'var(--accent-danger)') : 'var(--text-muted)' }}>
                                                        {ROUNDS[i]?.icon} {r.score}%
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    //  ROUND INTRO
    // ═══════════════════════════════════════════
    if (phase === 'round-intro') {
        const r = ROUNDS[currentRound];
        return (
            <div className="page">
                <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
                    {mode === 'full' && (
                        <div className="round-indicator" style={{ justifyContent: 'center', marginBottom: 32 }}>
                            {ROUNDS.map((_, i) => (<div key={i} className={`round-dot ${i < currentRound ? 'completed' : i === currentRound ? 'active' : ''}`} />))}
                        </div>
                    )}
                    <div style={{ fontSize: 72, marginBottom: 24 }}>{r.icon}</div>
                    <h2 style={{ fontSize: 28, marginBottom: 8 }}>
                        {mode === 'full' ? `Round ${currentRound + 1}: ` : ''}{r.name}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{r.desc}</p>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Time limit: {Math.floor(r.time / 60)} minutes</p>
                    {mode === 'full' && <p style={{ color: 'var(--accent-warning)', fontSize: 13, marginBottom: 32 }}><FiAlertTriangle style={{ marginRight: 4 }} /> Minimum passing score: {r.passScore}%</p>}

                    {/* Language selector for coding round */}
                    {r.type === 'coding' && (
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'block', marginBottom: 8 }}>Select Programming Language:</label>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                                {LANGUAGES.map(l => (
                                    <button key={l.id} className={`btn ${selectedLang === l.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                        onClick={() => setSelectedLang(l.id)}>{l.name}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button className="btn btn-primary btn-lg" onClick={startRound} disabled={loadingQuestions}>
                        {loadingQuestions ? <><div className="spinner" style={{ width: 18, height: 18, marginRight: 8, display: 'inline-block' }} /> Generating Questions via AI...</> : <><FiPlay /> Begin Round</>}
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    //  PLAYING
    // ═══════════════════════════════════════════
    if (phase === 'playing') {
        const round = ROUNDS[currentRound];
        return (
            <div className="game-container">
                {/* Header */}
                <div className="game-header">
                    <div>
                        <h3 style={{ fontSize: 16 }}>{mode === 'full' ? `Round ${currentRound + 1}: ` : ''}{round.name}</h3>
                        {mode === 'full' && <div className="round-indicator" style={{ marginTop: 8, marginBottom: 0 }}>
                            {ROUNDS.map((_, i) => (<div key={i} className={`round-dot ${i < currentRound ? 'completed' : i === currentRound ? 'active' : ''}`} />))}
                        </div>}
                    </div>
                    <div className={`game-timer ${timerClass}`}><FiClock /> {formatTime(timer)}</div>
                </div>

                {/* ─── MCQ ROUNDS (HackerRank-style) ─── */}
                {['aptitude', 'technical1'].includes(round.type) && questions.length > 0 && (
                    <div style={{ display: 'flex', gap: 20 }}>
                        {/* Question Navigator (HackerRank-style palette) */}
                        <div style={{ width: 260, flexShrink: 0 }}>
                            <div className="glass-card" style={{ position: 'sticky', top: 20 }}>
                                <h4 style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-muted)' }}>Question Navigator</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                    {questions.map((q, i) => {
                                        const answered = answers.some(a => a.questionId === q.id);
                                        return (
                                            <button key={i} onClick={() => setCurrentQ(i)}
                                                style={{
                                                    width: 38, height: 38, borderRadius: 6, border: currentQ === i ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                    background: answered ? 'rgba(201,162,75,0.15)' : currentQ === i ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                                                    color: answered ? 'var(--accent-success)' : 'var(--text-primary)',
                                                    cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                {i + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ marginTop: 16, display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(201,162,75,0.15)', border: '1px solid var(--accent-success)' }} /> Answered
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} /> Not answered
                                    </span>
                                </div>
                                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(201,162,75,0.04)', borderRadius: 6, fontSize: 12 }}>
                                    <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>{answers.length}</span>
                                    <span style={{ color: 'var(--text-muted)' }}> / {questions.length} answered</span>
                                </div>
                            </div>
                        </div>

                        {/* Question Content */}
                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>Question {currentQ + 1} of {questions.length}</p>
                            <div className="glass-card" style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 18, lineHeight: 1.7, marginBottom: 24 }}>{questions[currentQ].q}</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {questions[currentQ].opts.map((opt, oi) => {
                                        const sel = answers.find(a => a.questionId === questions[currentQ].id);
                                        return (
                                            <div key={oi} className={`option-card ${sel?.selectedAnswer === opt ? 'selected' : ''}`}
                                                onClick={() => selectAnswer(questions[currentQ].id, questions[currentQ].q, opt, questions[currentQ].ans)}>
                                                <span style={{ fontWeight: 600, marginRight: 12, color: 'var(--accent-primary)', minWidth: 20 }}>{String.fromCharCode(65 + oi)}.</span>{opt}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button className="btn btn-secondary" disabled={currentQ === 0} onClick={() => setCurrentQ(q => q - 1)}>Previous</button>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {currentQ < questions.length - 1
                                        ? <button className="btn btn-primary" onClick={() => setCurrentQ(q => q + 1)}>Next <FiArrowRight /></button>
                                        : null}
                                    <button className="btn btn-success" onClick={handleSubmitRound}><FiCheck /> Submit Round</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CODING ROUND (LeetCode-style) ─── */}
                {round.type === 'coding' && questions.length > 0 && (
                    <div style={{ height: 'calc(100vh - 160px)' }}>
                        {/* Problem tabs */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                            {questions.map((q, i) => (
                                <button key={q.id} className={`btn btn-sm ${currentQ === i ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setCurrentQ(i)}>
                                    <FiCode /> Problem {i + 1}: {q.title}
                                    {testResults[q.id]?.score !== undefined && (
                                        <span className={`badge ${testResults[q.id].score >= 60 ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                                            {testResults[q.id].passedCount}/{testResults[q.id].totalCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                            <div style={{ flex: 1 }} />
                            {/* Language Selector */}
                            <select className="form-select" style={{ width: 140, fontSize: 13 }} value={selectedLang}
                                onChange={e => setSelectedLang(e.target.value)}>
                                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: 'calc(100% - 50px)' }}>
                            {/* Left: Problem Description */}
                            <div className="glass-card" style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
                                    {['description', 'testcases', 'results'].map(tab => (
                                        <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`}
                                            onClick={() => setActiveTab(tab)}
                                            style={{ textTransform: 'capitalize', fontSize: 12 }}>
                                            {tab === 'results' ? `Results ${testResults[questions[currentQ]?.id]?.passedCount !== undefined ? `(${testResults[questions[currentQ]?.id]?.passedCount}/${testResults[questions[currentQ]?.id]?.totalCount})` : ''}` : tab}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === 'description' && (
                                    <div style={{ flex: 1, overflow: 'auto' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <h3 style={{ fontSize: 18, fontWeight: 700 }}>{questions[currentQ].title}</h3>
                                            <span className={`badge ${questions[currentQ].difficulty === 'Easy' ? 'badge-success' : questions[currentQ].difficulty === 'Medium' ? 'badge-warning' : 'badge-danger'}`}>
                                                {questions[currentQ].difficulty}
                                            </span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
                                            {questions[currentQ].description}
                                        </div>
                                        {questions[currentQ].examples?.map((ex, i) => (
                                            <div key={i} style={{ marginBottom: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-primary)' }}>
                                                <div style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700, marginBottom: 6 }}>Example {i + 1}:</div>
                                                <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
                                                    <div><strong>Input:</strong> <code>{ex.input}</code></div>
                                                    <div><strong>Output:</strong> <code>{ex.output}</code></div>
                                                    {ex.explanation && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}><strong>Explanation:</strong> {ex.explanation}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'testcases' && (
                                    <div style={{ flex: 1, overflow: 'auto' }}>
                                        <h4 style={{ marginBottom: 12, fontSize: 14 }}>Test Cases</h4>
                                        {questions[currentQ].testCases?.map((tc, i) => (
                                            <div key={i} style={{ marginBottom: 12, padding: 10, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'monospace' }}>
                                                <span className="badge badge-info" style={{ fontSize: 10, marginBottom: 6 }}>Case {i + 1}</span>
                                                <div><strong>Input:</strong> <pre style={{ margin: 0, marginTop: 2, color: 'var(--text-secondary)' }}>{tc.input}</pre></div>
                                                <div style={{ marginTop: 4 }}><strong>Expected:</strong> <code style={{ color: 'var(--accent-success)' }}>{tc.expectedOutput}</code></div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'results' && (
                                    <div style={{ flex: 1, overflow: 'auto' }}>
                                        {testResults[questions[currentQ]?.id] ? (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                    <h4 style={{ fontSize: 14 }}>Test Results</h4>
                                                    <span className={`badge ${testResults[questions[currentQ].id].score >= 60 ? 'badge-success' : 'badge-danger'}`}>
                                                        Score: {testResults[questions[currentQ].id].score}%
                                                    </span>
                                                </div>
                                                {testResults[questions[currentQ].id].testResults?.map((tr, i) => (
                                                    <div key={i} style={{
                                                        marginBottom: 8, padding: 10, borderRadius: 'var(--radius-sm)', fontSize: 13,
                                                        background: tr.passed ? 'rgba(201,162,75,0.06)' : 'rgba(192,70,43,0.06)',
                                                        border: `1px solid ${tr.passed ? 'rgba(201,162,75,0.2)' : 'rgba(192,70,43,0.2)'}`
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <span style={{ fontWeight: 600 }}>{tr.passed ? '✅' : '❌'} Test {tr.testCase}</span>
                                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tr.status} {tr.time ? `• ${tr.time}s` : ''}</span>
                                                        </div>
                                                        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Input:</span> {tr.input}</div>
                                                            <div><span style={{ color: 'var(--text-muted)' }}>Expected:</span> <span style={{ color: 'var(--accent-success)' }}>{tr.expectedOutput}</span></div>
                                                            {tr.actualOutput && <div><span style={{ color: 'var(--text-muted)' }}>Got:</span> <span style={{ color: tr.passed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{tr.actualOutput}</span></div>}
                                                            {tr.error && <div style={{ color: 'var(--accent-danger)', marginTop: 4 }}>Error: {tr.error}</div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div className="empty-state"><p>Run your code to see test results</p></div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: Code Editor */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ flex: 1, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                    <Editor
                                        height="100%"
                                        language={LANGUAGES.find(l => l.id === selectedLang)?.monacoLang || 'javascript'}
                                        theme="vs-dark"
                                        value={codeByProblem[questions[currentQ]?.id] || ''}
                                        onChange={v => setCodeByProblem(prev => ({ ...prev, [questions[currentQ]?.id]: v || '' }))}
                                        options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 4 }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-secondary" onClick={() => handleRunTests(questions[currentQ]?.id)} disabled={runningTests}>
                                            <FiTerminal /> {runningTests ? 'Running...' : 'Run Tests'}
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => handleRunCustom(questions[currentQ]?.id)} disabled={runningCustom}>
                                            <FiPlay /> {runningCustom ? 'Running...' : 'Run Custom'}
                                        </button>
                                    </div>
                                    <button className="btn btn-success" onClick={handleSubmitRound}><FiCheck /> Submit Round</button>
                                </div>
                                {/* Custom Input Console */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                                    <div>
                                        <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'block' }}>Custom Input (stdin)</label>
                                        <textarea className="form-textarea" rows={3} value={customInput} onChange={e => setCustomInput(e.target.value)}
                                            placeholder="Enter custom input..." style={{ fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'block' }}>Output</label>
                                        <pre style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'monospace', minHeight: 62, maxHeight: 80, overflow: 'auto', margin: 0, border: '1px solid var(--border-color)', color: customOutput.startsWith('Error') ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{customOutput || 'Output will appear here...'}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── GD ROUND (Live Multi-Participant) ─── */}
                {round.type === 'gd' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                        {/* Topic Banner */}
                        <div className="glass-card" style={{ padding: '12px 20px', marginBottom: 12, textAlign: 'center', flexShrink: 0 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>TOPIC</span>
                            <h3 style={{ color: 'var(--accent-primary)', fontSize: 16 }}>{gdTopic || 'Loading...'}</h3>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                                {gdParticipants.map(p => (
                                    <span key={p.name} className="badge badge-info" style={{ fontSize: 10 }}>{p.name} ({p.college})</span>
                                ))}
                                <span className="badge badge-success" style={{ fontSize: 10 }}>You</span>
                            </div>
                        </div>
                        {/* Chat Messages */}
                        <div className="chat-messages" style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            {gdMessages.map((msg, i) => (
                                <div key={i} className={`chat-bubble ${msg.speaker === 'You' ? 'user' : 'ai'}`}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {msg.speaker === 'You' ? <><FiUser /> You</> : <><FiCpu /> {msg.speaker} {msg.college ? `(${msg.college})` : ''}</>}
                                    </div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                                </div>
                            ))}
                            {gdLoading && <div className="chat-bubble ai"><div className="spinner" style={{ width: 20, height: 20, margin: 0 }} /></div>}
                            <div ref={chatEndRef} />
                        </div>
                        {/* Input */}
                        <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                            <input className="form-input" style={{ flex: 1 }} placeholder="Share your viewpoint, counter-argue, or add new points..."
                                value={gdInput} onChange={e => setGdInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGdSend()} disabled={gdLoading} />
                            <button className="btn btn-primary" onClick={handleGdSend} disabled={gdLoading || !gdInput.trim()}><FiSend /></button>
                            <button className="btn btn-success" onClick={handleSubmitRound} disabled={gdLoading}><FiCheck /> End &amp; Evaluate</button>
                        </div>
                        <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--text-muted)' }}>Your contributions: {gdUserCount} • Aim for at least 4-5 meaningful inputs</div>
                    </div>
                )}

                {/* ─── TECHNICAL ROUND 2 — AI Live Interview ─── */}
                {round.type === 'technical2' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                        <div className="chat-messages" style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                            {aiMessages.map((msg, i) => (
                                <div key={i} className={`chat-bubble ${msg.role === 'ai' ? 'ai' : 'user'}`}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {msg.role === 'ai' ? <><FiCpu /> AI Interviewer</> : <><FiUser /> You</>}
                                    </div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                </div>
                            ))}
                            {aiLoading && <div className="chat-bubble ai"><div className="spinner" style={{ width: 20, height: 20, margin: 0 }} /></div>}
                            <div ref={chatEndRef} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                            <input className="form-input" style={{ flex: 1 }} placeholder="Type your answer..." value={aiInput}
                                onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAiMessage()} />
                            <button className="btn btn-primary" onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}><FiSend /></button>
                            <button className="btn btn-success" onClick={handleSubmitRound} disabled={aiLoading}>End & Evaluate</button>
                        </div>
                    </div>
                )}

                {/* ─── HR ROUND ─── */}
                {round.type === 'hr' && questions.length > 0 && (
                    <div style={{ display: 'flex', gap: 20 }}>
                        {/* HR Navigator */}
                        <div style={{ width: 220, flexShrink: 0 }}>
                            <div className="glass-card" style={{ position: 'sticky', top: 20 }}>
                                <h4 style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-muted)' }}>Questions</h4>
                                {questions.map((q, i) => {
                                    const answered = hrAnswers[i]?.response?.length > 0;
                                    return (
                                        <div key={i} onClick={() => { setCurrentQ(i); setHrResponse(hrAnswers[i]?.response || ''); }}
                                            style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer', fontSize: 12,
                                                background: currentQ === i ? 'var(--bg-card-hover)' : 'transparent',
                                                borderLeft: `3px solid ${answered ? 'var(--accent-success)' : currentQ === i ? 'var(--accent-primary)' : 'transparent'}`,
                                                color: answered ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            Q{i + 1}. {q.q.slice(0, 30)}...
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>Question {currentQ + 1} of {questions.length}</p>
                            <div className="glass-card" style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 18, lineHeight: 1.7, marginBottom: 16 }}>{questions[currentQ].q}</h3>
                                <textarea className="form-textarea" rows={6} value={hrResponse} onChange={e => setHrResponse(e.target.value)} placeholder="Type your answer..." />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button className="btn btn-secondary" disabled={currentQ === 0}
                                    onClick={() => {
                                        setHrAnswers(prev => { const n = [...prev]; n[currentQ] = { questionId: questions[currentQ].id, response: hrResponse }; return n; });
                                        setCurrentQ(q => q - 1);
                                        setHrResponse(hrAnswers[currentQ - 1]?.response || '');
                                    }}>Previous</button>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {currentQ < questions.length - 1
                                        ? <button className="btn btn-primary" onClick={() => {
                                            setHrAnswers(prev => { const n = [...prev]; n[currentQ] = { questionId: questions[currentQ].id, response: hrResponse }; return n; });
                                            setCurrentQ(q => q + 1);
                                            setHrResponse(hrAnswers[currentQ + 1]?.response || '');
                                        }}>Next <FiArrowRight /></button>
                                        : null}
                                    <button className="btn btn-success" onClick={() => {
                                        setHrAnswers(prev => { const n = [...prev]; n[currentQ] = { questionId: questions[currentQ].id, response: hrResponse }; return n; });
                                        handleSubmitRound();
                                    }}><FiCheck /> Submit Round</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════
    //  FAILED
    // ═══════════════════════════════════════════
    if (phase === 'failed') {
        return (
            <div className="page">
                <div style={{ maxWidth: 700, margin: '40px auto', textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
                    <h1 className="page-title" style={{ fontSize: 32, marginBottom: 8 }}><span>Round Failed</span></h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: 16 }}>
                        You scored <strong style={{ color: 'var(--accent-danger)' }}>{roundScore}%</strong> in {ROUNDS[currentRound].name}
                    </p>
                    <p style={{ color: 'var(--accent-warning)', marginBottom: 32 }}>Minimum required: {ROUNDS[currentRound].passScore}%</p>

                    {failSuggestions && (
                        <div style={{ textAlign: 'left' }}>
                            <div className="glass-card" style={{ marginBottom: 20, borderLeft: '3px solid var(--accent-warning)' }}>
                                <h3 style={{ marginBottom: 16 }}>📚 Topics You Need to Focus On</h3>
                                {failSuggestions.topics.map((t, i) => (
                                    <div key={i} style={{ marginBottom: 16, padding: 16, background: 'rgba(201,162,75,0.04)', borderRadius: 'var(--radius-sm)' }}>
                                        <h4 style={{ color: 'var(--accent-primary)', marginBottom: 4 }}>{t.name}</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t.reason}</p>
                                        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/topics')}>📖 Go to {t.name}</button>
                                    </div>
                                ))}
                            </div>
                            <div className="glass-card" style={{ borderLeft: '3px solid var(--accent-secondary)' }}>
                                <h3 style={{ marginBottom: 12 }}>💡 Tips</h3>
                                {failSuggestions.tips.map((tip, i) => (
                                    <p key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8, paddingLeft: 16, borderLeft: '2px solid var(--border-color)' }}>• {tip}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-lg" onClick={() => setPhase('menu')}><FiRotateCcw /> Try Again</button>
                        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/topics')}>📚 Study Topics</button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    //  ROUND RESULT (passed)
    // ═══════════════════════════════════════════
    if (phase === 'round-result') {
        return (
            <div className="page">
                <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
                    <div className="score-ring" style={{ borderColor: roundScore >= 70 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                        <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{roundScore || 0}</span>
                    </div>
                    <h2 style={{ marginBottom: 8 }}>✅ {ROUNDS[currentRound].name} Passed!</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>You scored {roundScore}/100</p>
                    {mode === 'full' && <p style={{ color: 'var(--accent-success)', fontSize: 13, marginBottom: 32 }}>Cutoff: {ROUNDS[currentRound].passScore}% ✓</p>}

                    {aiEval && (
                        <div className="glass-card" style={{ textAlign: 'left', marginBottom: 24 }}>
                            <h4 style={{ marginBottom: 12, color: 'var(--accent-primary)' }}>AI Evaluation</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{aiEval.detailedFeedback}</p>
                        </div>
                    )}

                    <button className="btn btn-primary btn-lg" onClick={nextRound}>
                        {mode === 'single' || currentRound >= ROUNDS.length - 1 ? <><FiAward /> View Final Score</> : <>Next Round <FiArrowRight /></>}
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    //  FINAL SCORECARD
    // ═══════════════════════════════════════════
    if (phase === 'final') {
        const totalScore = game?.totalScore || 0;
        const maxScore = mode === 'single' ? 100 : (game?.maxTotalScore || 600);
        const pct = Math.round((totalScore / maxScore) * 100);
        const placed = mode === 'full' && pct >= 50;
        return (
            <div className="page">
                <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{placed ? '🎉' : '🏆'}</div>
                    <h1 className="page-title" style={{ fontSize: 36, marginBottom: 8 }}>
                        <span>{mode === 'single' ? 'Round Complete!' : placed ? 'Congratulations! You Got Placed!' : 'Interview Complete!'}</span>
                    </h1>
                    {mode === 'full' && (
                        <p style={{ color: placed ? 'var(--accent-success)' : 'var(--text-muted)', fontSize: 16, marginBottom: 24 }}>
                            {placed ? 'You cleared all rounds! 🎊' : 'Keep practicing to improve.'}
                        </p>
                    )}
                    <div className="score-ring" style={{ width: 180, height: 180, fontSize: 48, margin: '0 auto 32px', borderColor: pct >= 70 ? 'var(--accent-success)' : pct >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>
                        <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{mode === 'single' ? roundScore : pct}%</span>
                    </div>
                    {mode === 'full' && (
                        <div className="grid grid-3" style={{ marginBottom: 40 }}>
                            {ROUNDS.map((r, i) => {
                                const s = game?.rounds?.[i]?.score;
                                const passed = s >= r.passScore;
                                return (
                                    <div key={r.type} className="glass-card" style={{ padding: 16, textAlign: 'center', borderLeft: `3px solid ${passed ? 'var(--accent-success)' : s !== undefined ? 'var(--accent-danger)' : 'var(--border-color)'}` }}>
                                        <div style={{ fontSize: 24, marginBottom: 4 }}>{r.icon}</div>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.name}</p>
                                        <p style={{ fontSize: 22, fontWeight: 800, color: passed ? 'var(--accent-success)' : s !== undefined ? 'var(--accent-danger)' : 'var(--text-muted)' }}>{s !== undefined ? s : '—'}</p>
                                        <span className={`badge ${passed ? 'badge-success' : s !== undefined ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: 10 }}>{passed ? 'PASS' : s !== undefined ? 'FAIL' : 'N/A'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <button className="btn btn-primary btn-lg" onClick={() => setPhase('menu')}><FiRotateCcw /> Play Again</button>
                </div>
            </div>
        );
    }

    return null;
};

export default InterviewGame;
