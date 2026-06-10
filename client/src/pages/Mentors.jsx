import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMentors, getAvailability, bookSession } from '../services/api';
import { FiSearch, FiStar, FiBriefcase, FiClock, FiCalendar, FiFilter, FiCheck, FiX, FiUser, FiUsers } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Mentors = () => {
    const { user } = useAuth();
    const [mentors, setMentors] = useState([]);
    const [search, setSearch] = useState('');
    const [skillFilter, setSkillFilter] = useState('');
    const [sortBy, setSortBy] = useState('relevance'); // relevance | rating | experience
    const [loading, setLoading] = useState(true);
    const [expandedMentor, setExpandedMentor] = useState(null);
    const [availability, setAvailability] = useState(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [bookingSlot, setBookingSlot] = useState(null);
    const [bookingAgenda, setBookingAgenda] = useState('');
    const [bookingSuccess, setBookingSuccess] = useState(null);
    const navigate = useNavigate();

    useEffect(() => { fetchMentors(); }, []);

    const fetchMentors = async (company = '') => {
        setLoading(true);
        try {
            const res = await getMentors(company ? { company } : {});
            let mentorList = res.data.mentors || [];

            // Sort by relevance to user's skills/aimingCompany
            if (sortBy === 'relevance' && user) {
                const userSkills = (user.skills || []).map(s => s.toLowerCase());
                const userCompany = (user.aimingCompany || '').toLowerCase();
                mentorList = mentorList.map(m => {
                    const mentorSkills = [...(m.skills || []), ...(m.expertise || [])].map(s => s.toLowerCase());
                    const skillMatch = userSkills.filter(s => mentorSkills.some(ms => ms.includes(s) || s.includes(ms))).length;
                    const companyMatch = userCompany && (m.currentCompany || '').toLowerCase().includes(userCompany) ? 5 : 0;
                    return { ...m, relevanceScore: skillMatch + companyMatch };
                }).sort((a, b) => b.relevanceScore - a.relevanceScore);
            } else if (sortBy === 'rating') {
                mentorList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (sortBy === 'experience') {
                mentorList.sort((a, b) => (b.experience || 0) - (a.experience || 0));
            }

            // Skill filter
            if (skillFilter) {
                const sf = skillFilter.toLowerCase();
                mentorList = mentorList.filter(m => {
                    const allSkills = [...(m.skills || []), ...(m.expertise || [])].map(s => s.toLowerCase());
                    return allSkills.some(s => s.includes(sf));
                });
            }

            setMentors(mentorList);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleSearch = () => fetchMentors(search);

    const toggleExpand = async (mentorId) => {
        if (expandedMentor === mentorId) {
            setExpandedMentor(null);
            setAvailability(null);
            return;
        }
        setExpandedMentor(mentorId);
        setLoadingSlots(true);
        setBookingSlot(null);
        setBookingSuccess(null);
        try {
            const res = await getAvailability(mentorId);
            setAvailability(res.data.availability);
        } catch { setAvailability({ weeklySlots: [], availableSlots: [] }); }
        setLoadingSlots(false);
    };

    const handleBookSlot = async (mentor, slot, slotIndex) => {
        setBookingSlot({ mentor, slot, slotIndex });
    };

    const confirmBooking = async () => {
        if (!bookingSlot) return;
        try {
            // Calculate next occurrence of the day
            const dayIndex = DAYS.indexOf(bookingSlot.slot.day);
            const today = new Date();
            const todayDay = (today.getDay() + 6) % 7; // Monday=0
            let daysUntil = dayIndex - todayDay;
            if (daysUntil < 0) daysUntil += 7;
            if (daysUntil === 0) daysUntil = 7; // Book for next week if same day
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + daysUntil);

            // Combine date with start time to get proper scheduledDate
            if (bookingSlot.slot.startTime) {
                const [hours, minutes] = bookingSlot.slot.startTime.split(':').map(Number);
                nextDate.setHours(hours, minutes, 0, 0);
            }

            // Calculate duration from start/end time
            let duration = 60;
            if (bookingSlot.slot.startTime && bookingSlot.slot.endTime) {
                const [sh, sm] = bookingSlot.slot.startTime.split(':').map(Number);
                const [eh, em] = bookingSlot.slot.endTime.split(':').map(Number);
                duration = (eh * 60 + em) - (sh * 60 + sm);
                if (duration <= 0) duration = 60;
            }

            await bookSession({
                mentor: bookingSlot.mentor._id,
                scheduledDate: nextDate.toISOString(),
                agenda: bookingAgenda || `Session with ${bookingSlot.mentor.name}`,
                duration
            });

            setBookingSuccess(`Session booked with ${bookingSlot.mentor.name} for ${bookingSlot.slot.day} ${bookingSlot.slot.startTime}-${bookingSlot.slot.endTime}`);
            setBookingSlot(null);
            setBookingAgenda('');
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || 'Failed to book session. Try again.';
            setBookingSuccess(`❌ ${msg}`);
        }
    };

    // Get unique skills across all mentors for filter
    const allSkills = [...new Set(mentors.flatMap(m => [...(m.skills || []), ...(m.expertise || [])]))].slice(0, 15);

    return (
        <div className="page">
            <PageHero
                eyebrow="Career"
                title="Find Mentors"
                subtitle="Connect with people who landed the roles you're aiming for."
                icon={<FiUsers />}
            />

            {/* Search & Filters */}
            <div className="glass-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search by company name..."
                        value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                    <select className="form-select" style={{ width: 180 }} value={sortBy} onChange={e => { setSortBy(e.target.value); fetchMentors(search); }}>
                        <option value="relevance">Best Match</option>
                        <option value="rating">Highest Rated</option>
                        <option value="experience">Most Experienced</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleSearch}><FiSearch /> Search</button>
                </div>

                {/* Skill Chips */}
                {allSkills.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '28px' }}><FiFilter /> Filter by skill:</span>
                        <button className={`chip ${!skillFilter ? 'active' : ''}`} onClick={() => { setSkillFilter(''); fetchMentors(search); }}
                            style={{ background: !skillFilter ? 'rgba(201,162,75,0.15)' : undefined, borderColor: !skillFilter ? 'var(--accent-primary)' : undefined }}>All</button>
                        {allSkills.map(s => (
                            <button key={s} className={`chip ${skillFilter === s ? 'active' : ''}`}
                                onClick={() => { setSkillFilter(skillFilter === s ? '' : s); }}
                                style={{ cursor: 'pointer', background: skillFilter === s ? 'rgba(201,162,75,0.15)' : undefined, borderColor: skillFilter === s ? 'var(--accent-primary)' : undefined, color: skillFilter === s ? 'var(--accent-primary)' : undefined }}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Mentor Cards */}
            {loading ? <SkeletonGrid count={4} cols={1} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {mentors.map((m, idx) => (
                        <Reveal as="div" key={m._id} i={idx} className="glass-card spotlight">
                            {/* Main card */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, cursor: 'pointer' }} onClick={() => toggleExpand(m._id)}>
                                <div style={{ display: 'flex', gap: 16, flex: 1 }}>
                                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--gradient-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', flexShrink: 0, position: 'relative' }}>
                                        {m.name?.[0]}
                                        {m.isOnline && <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-primary)', border: '2px solid var(--bg-card)' }} />}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</h3>
                                            {m.isOnline && <span className="badge badge-success" style={{ fontSize: 10 }}>Online</span>}
                                        </div>
                                        {m.currentCompany && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
                                                <FiBriefcase /> {m.currentCompany} {m.experience ? `• ${m.experience} years` : ''}
                                            </div>
                                        )}
                                        {m.bio && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 500 }}>{m.bio?.slice(0, 150)}{m.bio?.length > 150 ? '...' : ''}</p>}
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                            {[...(m.skills || []), ...(m.expertise || [])].slice(0, 6).map((s, i) => (
                                                <span key={i} className="chip" style={{ fontSize: 11 }}>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-warning)' }}>
                                        <FiStar /> <span style={{ fontWeight: 600 }}>{m.rating?.toFixed(1) || '0.0'}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({m.totalReviews || 0})</span>
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); toggleExpand(m._id); }}>
                                        <FiCalendar /> {expandedMentor === m._id ? 'Hide Slots' : 'View Slots'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); navigate(`/mentor/${m._id}`); }}>
                                        <FiUser /> Full Profile
                                    </button>
                                </div>
                            </div>

                            {/* Expanded: Availability slots */}
                            {expandedMentor === m._id && (
                                <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                                    <h4 style={{ marginBottom: 16, fontSize: 14 }}><FiClock style={{ marginRight: 4 }} /> Available Slots</h4>

                                    {loadingSlots ? <div className="spinner" style={{ margin: '20px auto' }} /> : (
                                        <>
                                            {/* Weekly recurring slots */}
                                            {availability?.weeklySlots?.length > 0 && (
                                                <div style={{ marginBottom: 20 }}>
                                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>📅 Weekly Recurring Slots</p>
                                                    <div className="grid grid-4" style={{ gap: 8 }}>
                                                        {DAYS.map(day => {
                                                            const daySlots = availability.weeklySlots.filter(s => s.day === day && s.isAvailable !== false);
                                                            if (daySlots.length === 0) return null;
                                                            return (
                                                                <div key={day} className="glass-card" style={{ padding: 12, background: 'var(--bg-input)' }}>
                                                                    <h5 style={{ fontSize: 12, color: 'var(--accent-primary)', marginBottom: 8 }}>{day}</h5>
                                                                    {daySlots.map((slot, si) => (
                                                                        <button key={si} className="btn btn-secondary btn-sm" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
                                                                            onClick={() => handleBookSlot(m, slot, si)}>
                                                                            {slot.startTime} - {slot.endTime}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Specific date slots */}
                                            {availability?.availableSlots?.length > 0 && (
                                                <div>
                                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>📆 Specific Date Slots</p>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                        {availability.availableSlots.filter(s => !s.isBooked).map((slot, i) => (
                                                            <button key={i} className="btn btn-secondary btn-sm" onClick={() => handleBookSlot(m, { ...slot, day: new Date(slot.date).toLocaleDateString('en-US', { weekday: 'long' }) }, i)}>
                                                                {new Date(slot.date).toLocaleDateString()} {slot.startTime}-{slot.endTime}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {(!availability?.weeklySlots?.length && !availability?.availableSlots?.filter(s => !s.isBooked)?.length) && (
                                                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No availability slots set by this mentor yet. Check their full profile to message them.</p>
                                            )}

                                            {/* Booking success message */}
                                            {bookingSuccess && (
                                                <div style={{ marginTop: 16, padding: 12, background: 'rgba(201,162,75,0.08)', border: '1px solid rgba(201,162,75,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-success)', fontSize: 13 }}>
                                                    <FiCheck style={{ marginRight: 4 }} /> {bookingSuccess}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </Reveal>
                    ))}
                </div>
            )}
            {!loading && mentors.length === 0 && <div className="empty-state"><div className="icon"><FiUsers /></div><p>No mentors found.</p></div>}

            {/* Booking Confirmation Modal */}
            {bookingSlot && (
                <Modal onClose={() => setBookingSlot(null)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2>Book Session</h2>
                            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setBookingSlot(null)}><FiX /></button>
                        </div>
                        <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white' }}>{bookingSlot.mentor.name?.[0]}</div>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{bookingSlot.mentor.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bookingSlot.mentor.currentCompany}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
                                <span><FiCalendar style={{ marginRight: 4 }} />{bookingSlot.slot.day}</span>
                                <span><FiClock style={{ marginRight: 4 }} />{bookingSlot.slot.startTime} - {bookingSlot.slot.endTime}</span>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Session Agenda (optional)</label>
                            <textarea className="form-textarea" rows={3} value={bookingAgenda} onChange={e => setBookingAgenda(e.target.value)}
                                placeholder="What would you like to discuss? Eg: DSA doubts, mock interview, resume review..." />
                        </div>
                        <button className="btn btn-action" style={{ width: '100%' }} onClick={confirmBooking}>
                            <FiCheck /> Confirm Booking
                        </button>
                </Modal>
            )}
        </div>
    );
};

export default Mentors;
