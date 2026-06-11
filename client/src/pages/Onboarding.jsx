import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTopics, submitOnboarding, generateLearningPath } from '../services/api';
import { FiTarget, FiArrowRight, FiCheck } from 'react-icons/fi';

const LEVELS = [
    { value: 'beginner', label: 'Beginner', desc: 'New to placement prep' },
    { value: 'intermediate', label: 'Intermediate', desc: 'Some practice done' },
    { value: 'advanced', label: 'Advanced', desc: 'Polishing for interviews' },
];

const RATINGS = [
    { value: 'low', label: 'Weak', score: 1 },
    { value: 'medium', label: 'OK', score: 2 },
    { value: 'high', label: 'Strong', score: 3 },
];

// A diagnostic onboarding (C7): target role + experience + a quick confidence
// self-rating across topics → a generated prep plan for the weakest area.
const Onboarding = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [topics, setTopics] = useState([]);
    const [aimingCompany, setAimingCompany] = useState(user?.aimingCompany || '');
    const [level, setLevel] = useState(user?.experienceLevel || 'beginner');
    const [ratings, setRatings] = useState({});           // topicId -> 'low'|'medium'|'high'
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getTopics().then((res) => {
            const list = (res.data.topics || []).slice(0, 8);
            setTopics(list);
            setRatings(Object.fromEntries(list.map((t) => [t._id, 'medium'])));
        }).catch(() => setTopics([]));
    }, []);

    // Mentees who already onboarded (or non-mentees) shouldn't see this.
    if (user && (user.role !== 'mentee' || user.onboarded)) {
        return <Navigate to="/dashboard" replace />;
    }

    const weakestTopicId = () => {
        let weakest = null;
        let min = Infinity;
        for (const t of topics) {
            const score = RATINGS.find((r) => r.value === ratings[t._id])?.score ?? 2;
            if (score < min) { min = score; weakest = t._id; }
        }
        return weakest;
    };

    const finish = async () => {
        setSubmitting(true);
        setError('');
        // Strengths (topics rated "Strong") seed the profile skills.
        const strengths = topics.filter((t) => ratings[t._id] === 'high').map((t) => t.name);
        try {
            await submitOnboarding({ aimingCompany, experienceLevel: level, skills: strengths });
            // Best-effort: generate a prep plan for the weakest area. Never block
            // completing onboarding if generation fails (e.g. topic has no resources).
            const topicId = weakestTopicId();
            let createdPath = null;
            if (topicId) {
                try {
                    const { data } = await generateLearningPath({ topicId, level });
                    createdPath = data.path;
                } catch { /* no resources / AI error — proceed without a plan */ }
            }
            await refreshUser();
            navigate(createdPath ? '/learning-paths' : '/dashboard', { replace: true });
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not save your onboarding. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="page" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="glass-card" style={{ padding: 32, marginTop: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <FiTarget style={{ fontSize: 28, color: 'var(--accent-primary, #10b981)' }} />
                    <h1 style={{ fontSize: 24 }}>Let's personalize your prep</h1>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
                    Step {step} of 2 — a quick diagnostic so we can build your first plan.
                </p>

                {step === 1 && (
                    <>
                        <div className="form-group">
                            <label>Target role or company</label>
                            <input
                                className="form-input"
                                placeholder="e.g. Amazon SDE, Backend Engineer"
                                value={aimingCompany}
                                onChange={(e) => setAimingCompany(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Where are you in your prep?</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                {LEVELS.map((l) => (
                                    <div
                                        key={l.value}
                                        onClick={() => setLevel(l.value)}
                                        className="card"
                                        style={{
                                            padding: 14, cursor: 'pointer',
                                            border: level === l.value ? '2px solid var(--accent-primary, #10b981)' : '1px solid var(--border)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{l.label}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.desc}</div>
                                            </div>
                                            {level === l.value && <FiCheck style={{ color: 'var(--accent-primary, #10b981)' }} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep(2)}>
                            Next <FiArrowRight />
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="form-group">
                            <label>How confident are you in each area?</label>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                We'll build your first plan around your weakest area.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {topics.map((t) => (
                                    <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: 14 }}>{t.name}</span>
                                        <div style={{ display: 'inline-flex', gap: 6 }}>
                                            {RATINGS.map((r) => (
                                                <button
                                                    key={r.value}
                                                    className={`btn btn-sm ${ratings[t._id] === r.value ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => setRatings((prev) => ({ ...prev, [t._id]: r.value }))}
                                                >{r.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {topics.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No topics available — you can skip this.</p>}
                            </div>
                        </div>
                        {error && <p style={{ color: 'var(--accent-danger, #ef4444)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-secondary" onClick={() => setStep(1)} disabled={submitting}>Back</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish} disabled={submitting}>
                                {submitting ? 'Building your plan…' : 'Finish & build my plan'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
