import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMentors } from '../services/api';
import { FiSearch, FiStar, FiBriefcase, FiMapPin } from 'react-icons/fi';

const Mentors = () => {
    const [mentors, setMentors] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchMentors();
    }, []);

    const fetchMentors = async (company = '') => {
        setLoading(true);
        try {
            const res = await getMentors(company ? { company } : {});
            setMentors(res.data.mentors || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleSearch = () => fetchMentors(search);

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">👨‍🏫 <span>Find Mentors</span></h1>
            </div>

            <div className="glass-card" style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Search by company name..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <button className="btn btn-primary" onClick={handleSearch}><FiSearch /> Search</button>
            </div>

            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {mentors.map((m) => (
                        <div key={m._id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/mentor/${m._id}`)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gradient-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                    {m.name?.[0]}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</h3>
                                    {m.currentCompany && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                                            <FiBriefcase /> {m.currentCompany}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {m.bio && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{m.bio?.slice(0, 120)}...</p>}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                {m.skills?.slice(0, 4).map((s, i) => <span key={i} className="chip">{s}</span>)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-warning)' }}>
                                    <FiStar /> <span style={{ fontWeight: 600 }}>{m.rating?.toFixed(1) || '0.0'}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({m.totalReviews || 0})</span>
                                </div>
                                <button className="btn btn-primary btn-sm">View Profile</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!loading && mentors.length === 0 && <div className="empty-state"><div className="icon">👨‍🏫</div><p>No mentors found. Try a different search.</p></div>}
        </div>
    );
};

export default Mentors;
