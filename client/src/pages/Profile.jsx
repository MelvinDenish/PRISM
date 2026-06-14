import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateMe, getCompanies, getMyEligibility, getPrepProfile } from '../services/api';
import { FiUser, FiSave, FiCheckCircle, FiXCircle, FiAlertCircle, FiAward, FiTarget } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';

// Fields the student self-edits (mirrors the PUT /api/users/me whitelist).
const STRING_FIELDS = [
    ['name', 'Full name', 'text'],
    ['registerNumber', 'Register number', 'text'],
    ['department', 'Department / branch', 'text'],
    ['college', 'College', 'text'],
    ['batch', 'Batch', 'text'],
    ['linkedin', 'LinkedIn URL', 'text'],
    ['github', 'GitHub URL', 'text'],
];
const NUMBER_FIELDS = [
    ['cgpa', 'CGPA', '0 – 10'],
    ['graduationYear', 'Graduation year', 'e.g. 2026'],
    ['tenthPercent', '10th %', '0 – 100'],
    ['twelfthPercent', '12th %', '0 – 100'],
    ['activeArrears', 'Active arrears', '0'],
    ['historyArrears', 'Arrears history', '0'],
];

const READINESS_LABELS = { aptitude: 'Aptitude', dsa: 'DSA', cs_core: 'CS Core', communication: 'Communication', resume: 'Resume' };

const blankForm = (u = {}) => {
    const f = {};
    for (const [k] of [...STRING_FIELDS, ...NUMBER_FIELDS]) f[k] = u[k] ?? '';
    return f;
};

const Profile = () => {
    const { user, refreshUser } = useAuth();
    const [form, setForm] = useState(blankForm(user));
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [error, setError] = useState('');
    const [companies, setCompanies] = useState([]);
    const [eligibility, setEligibility] = useState({});
    const [prep, setPrep] = useState(null);

    // Re-seed the form whenever the global user object changes (e.g. after save).
    useEffect(() => { setForm(blankForm(user)); }, [user]);

    const loadEligibility = useCallback(async () => {
        try {
            const [{ data: cData }, { data: eData }] = await Promise.all([getCompanies(), getMyEligibility()]);
            setCompanies(cData.companies || []);
            setEligibility(eData.eligibility || {});
        } catch { /* eligibility is best-effort */ }
    }, []);

    useEffect(() => {
        loadEligibility();
        if (user?.role === 'mentee') {
            getPrepProfile().then(({ data }) => setPrep(data.profile)).catch(() => {});
        }
    }, [loadEligibility, user?.role]);

    const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const save = async (e) => {
        e.preventDefault();
        setSaving(true); setError(''); setSavedAt(null);
        try {
            await updateMe(form);
            await refreshUser();
            await loadEligibility();
            setSavedAt(Date.now());
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not save your profile.');
        }
        setSaving(false);
    };

    // Split eligible / not-eligible / unknown for the summary.
    const rows = companies.map((c) => ({ company: c, e: eligibility[c._id] }));
    const eligibleCount = rows.filter((r) => r.e?.eligible).length;

    return (
        <div className="page">
            <PageHero
                eyebrow="Account"
                title="My Profile"
                subtitle="Your identity and academic record. These power your CUIC resume export and your company eligibility."
                icon={<FiUser />}
            />

            <div className="grid grid-2" style={{ alignItems: 'start', gap: 20 }}>
                {/* ── Identity & academics ── */}
                <Reveal as="form" className="glass-card" i={0} style={{ padding: 24 }} onSubmit={save}>
                    <h3 className="card-title" style={{ marginBottom: 4 }}>Identity & academics</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Register number and name set your resume filename (<code>RegisterNumber_Name.pdf</code>).</p>

                    <div className="grid grid-2" style={{ gap: 12 }}>
                        {STRING_FIELDS.map(([k, label]) => (
                            <div className="form-group" key={k} style={k === 'name' ? { gridColumn: '1 / -1' } : undefined}>
                                <label>{label}</label>
                                <input className="form-input" value={form[k]} onChange={(e) => onChange(k, e.target.value)} />
                            </div>
                        ))}
                        {NUMBER_FIELDS.map(([k, label, hint]) => (
                            <div className="form-group" key={k}>
                                <label>{label}</label>
                                <input className="form-input" type="number" step="any" placeholder={hint} value={form[k]} onChange={(e) => onChange(k, e.target.value)} />
                            </div>
                        ))}
                    </div>

                    {error && <div style={{ color: 'var(--accent-danger, #dc2626)', fontSize: 13, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><FiAlertCircle /> {error}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <button className="btn btn-primary" disabled={saving}><FiSave /> {saving ? 'Saving…' : 'Save profile'}</button>
                        {savedAt && <span style={{ fontSize: 13, color: 'var(--accent-success, #16a34a)', display: 'flex', gap: 6, alignItems: 'center' }}><FiCheckCircle /> Saved</span>}
                    </div>
                </Reveal>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* ── Mentee readiness + targets ── */}
                    {user?.role === 'mentee' && prep && (
                        <Reveal as="div" className="glass-card" i={1} style={{ padding: 24 }}>
                            <h3 className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FiTarget /> Readiness</h3>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-primary)' }}>{prep.readiness?.overall ?? 0}</span>
                                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>/ 100 overall</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {Object.entries(READINESS_LABELS).map(([k, label]) => {
                                    const s = prep.readiness?.pillars?.[k];
                                    const score = s?.sampleCount ? s.score : null;
                                    return (
                                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 12, width: 110, color: 'var(--text-secondary)' }}>{label}</span>
                                            <div style={{ flex: 1, height: 6, background: 'var(--surface-2, rgba(255,255,255,0.06))', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ width: `${score ?? 0}%`, height: '100%', background: 'var(--accent-primary)' }} />
                                            </div>
                                            <span style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{score == null ? '—' : score}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {prep.targetRole && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>Target role: <strong>{prep.targetRole}</strong></p>}
                            {prep.targetCompanies?.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                    {prep.targetCompanies.map((c, i) => <span key={i} className="chip" style={{ fontSize: 11 }}>{c.name}</span>)}
                                </div>
                            )}
                        </Reveal>
                    )}

                    {/* ── Eligibility summary ── */}
                    <Reveal as="div" className="glass-card" i={2} style={{ padding: 24 }}>
                        <h3 className="card-title" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FiAward /> Company eligibility
                            <span className="chip" style={{ marginLeft: 'auto', fontSize: 11 }}>{eligibleCount}/{rows.length} eligible</span>
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Based on your academics against each company's CUIC criteria.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                            {rows.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No companies yet.</p>}
                            {rows.map(({ company, e }) => {
                                const state = !e ? 'open' : e.eligible ? 'eligible' : e.unknown ? 'unknown' : 'no';
                                const cfg = {
                                    eligible: { icon: <FiCheckCircle />, color: 'var(--accent-success, #16a34a)', label: 'Eligible' },
                                    no: { icon: <FiXCircle />, color: 'var(--accent-danger, #dc2626)', label: 'Not eligible' },
                                    unknown: { icon: <FiAlertCircle />, color: 'var(--accent-primary)', label: 'Complete profile' },
                                    open: { icon: <FiCheckCircle />, color: 'var(--text-muted, #94a3b8)', label: 'Open' },
                                }[state];
                                const note = e?.reasons?.length ? e.reasons.join('; ') : e?.missing?.length ? `Add: ${e.missing.join(', ')}` : '';
                                return (
                                    <div key={company._id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                                        <span style={{ color: cfg.color, marginTop: 2, flexShrink: 0 }}>{cfg.icon}</span>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <strong style={{ fontSize: 14 }}>{company.name}</strong>
                                                <span style={{ fontSize: 11, color: cfg.color }}>{cfg.label}</span>
                                            </div>
                                            {note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Reveal>
                </div>
            </div>
        </div>
    );
};

export default Profile;
