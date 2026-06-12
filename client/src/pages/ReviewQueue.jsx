import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getReviewQueue, getReviewStats, gradeReviewItem, dismissReviewItem } from '../services/api';
import { FiRepeat, FiCheck, FiRotateCcw, FiX, FiEye, FiCode, FiBook, FiHelpCircle } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';

// How each kind of review item presents + where its "practice again" link goes.
const KIND_META = {
    mcq: { label: 'MCQ', icon: <FiHelpCircle />, action: null },
    coding: { label: 'Coding', icon: <FiCode />, action: { to: '/coding-questions', text: 'Practice problem' } },
    topic: { label: 'Topic', icon: <FiBook />, action: { to: '/topics', text: 'Study topic' } },
};

const ReviewQueue = () => {
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({ due: 0, active: 0, mastered: 0 });
    const [loading, setLoading] = useState(true);
    const [revealed, setRevealed] = useState(() => new Set());
    const [busy, setBusy] = useState(null); // id currently being graded/dismissed

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [q, s] = await Promise.all([getReviewQueue(), getReviewStats()]);
            setItems(q.data.items || []);
            setStats(s.data.stats || { due: 0, active: 0, mastered: 0 });
        } catch { setItems([]); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const reveal = (id) => setRevealed((prev) => new Set(prev).add(id));

    // Optimistically drop the item, then sync stats from the server.
    const grade = async (id, remembered) => {
        setBusy(id);
        setItems((prev) => prev.filter((i) => i._id !== id));
        try { await gradeReviewItem(id, remembered); const { data } = await getReviewStats(); setStats(data.stats); }
        catch { load(); }
        setBusy(null);
    };

    const dismiss = async (id) => {
        setBusy(id);
        setItems((prev) => prev.filter((i) => i._id !== id));
        try { await dismissReviewItem(id); const { data } = await getReviewStats(); setStats(data.stats); }
        catch { load(); }
        setBusy(null);
    };

    const STAT_CARDS = [
        { label: 'Due now', value: stats.due, color: 'var(--accent-primary, #10b981)' },
        { label: 'In rotation', value: stats.active },
        { label: 'Mastered', value: stats.mastered, color: 'var(--accent-secondary, #14b8a6)' },
    ];

    return (
        <div className="page">
            <PageHero
                eyebrow="Spaced Repetition"
                title="Review Queue"
                subtitle="The things you missed or are weak at, resurfaced on a schedule. Grade each one honestly — remembered pushes it further out, forgotten brings it back soon."
                icon={<FiRepeat />}
            />

            <div className="grid grid-3" style={{ marginBottom: 24 }}>
                {STAT_CARDS.map((c) => (
                    <div key={c.label} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: 30, fontWeight: 800, color: c.color || 'var(--text-primary)' }}>{c.value}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.label}</div>
                    </div>
                ))}
            </div>

            {loading ? <SkeletonGrid count={3} cols={1} /> : items.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                    <FiCheck style={{ fontSize: 32, color: 'var(--accent-primary, #10b981)', marginBottom: 8 }} />
                    <h3 style={{ fontSize: 16, marginBottom: 6 }}>Nothing due right now</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                        You're caught up. As you miss MCQs, fail coding problems, or fall behind on topics, they'll show up here to review.
                    </p>
                </div>
            ) : (
                <div className="grid grid-1" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {items.map((item, i) => {
                        const meta = KIND_META[item.kind] || KIND_META.mcq;
                        const isRevealed = revealed.has(item._id);
                        return (
                            <Reveal as="div" key={item._id} i={i} className="glass-card spotlight" style={{ padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>{meta.icon} {meta.label}</span>
                                        {item.difficulty && <span className="chip" style={{ fontSize: 11 }}>{item.difficulty}</span>}
                                        {item.category && <span className="chip" style={{ fontSize: 11 }}>{item.category}</span>}
                                    </div>
                                    <button className="icon-btn" title="Dismiss" disabled={busy === item._id} onClick={() => dismiss(item._id)}><FiX /></button>
                                </div>

                                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 6px' }}>{item.prompt}</h3>

                                {item.kind === 'mcq' ? (
                                    !isRevealed ? (
                                        <button className="btn btn-secondary btn-sm" onClick={() => reveal(item._id)}><FiEye /> Show answer</button>
                                    ) : (
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {item.answer && <div style={{ marginBottom: 4 }}><strong style={{ color: 'var(--accent-primary, #10b981)' }}>Answer:</strong> {item.answer}</div>}
                                            {item.explanation && <div>{item.explanation}</div>}
                                        </div>
                                    )
                                ) : (
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.explanation}</p>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary btn-sm" disabled={busy === item._id} onClick={() => grade(item._id, true)}><FiCheck /> Got it</button>
                                    <button className="btn btn-secondary btn-sm" disabled={busy === item._id} onClick={() => grade(item._id, false)}><FiRotateCcw /> Review again</button>
                                    {meta.action && <Link className="btn btn-ghost btn-sm" to={meta.action.to}>{meta.action.text} →</Link>}
                                </div>
                            </Reveal>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReviewQueue;
