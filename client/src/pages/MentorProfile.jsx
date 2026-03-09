import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getUserById, getAvailability, bookSession } from '../services/api';
import { FiStar, FiBriefcase, FiCalendar, FiMail } from 'react-icons/fi';

const MentorProfile = () => {
    const { id } = useParams();
    const [mentor, setMentor] = useState(null);
    const [availability, setAvailability] = useState([]);
    const [showBooking, setShowBooking] = useState(false);
    const [bookingData, setBookingData] = useState({ scheduledDate: '', duration: 30, agenda: '' });
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [mRes, aRes] = await Promise.all([
                    getUserById(id),
                    getAvailability(id).catch(() => ({ data: { availability: { availableSlots: [] } } }))
                ]);
                setMentor(mRes.data.user);
                setAvailability(aRes.data.availability?.availableSlots || []);
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetch();
    }, [id]);

    const handleBook = async (e) => {
        e.preventDefault();
        try {
            await bookSession({ mentor: id, ...bookingData });
            setSuccess('Session booked successfully! Waiting for mentor approval.');
            setShowBooking(false);
        } catch (err) { console.error(err); }
    };

    if (loading) return <div className="page"><div className="spinner" /></div>;
    if (!mentor) return <div className="page"><div className="empty-state"><p>Mentor not found</p></div></div>;

    return (
        <div className="page">
            <div className="glass-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 32, alignItems: 'start', flexWrap: 'wrap' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {mentor.name?.[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{mentor.name}</h1>
                        <div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)', fontSize: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                            {mentor.currentCompany && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiBriefcase /> {mentor.currentCompany}</span>}
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiMail /> {mentor.email}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-warning)' }}><FiStar /> {mentor.rating?.toFixed(1)} ({mentor.totalReviews} reviews)</span>
                        </div>
                        {mentor.bio && <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>{mentor.bio}</p>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {mentor.skills?.map((s, i) => <span key={i} className="badge badge-primary">{s}</span>)}
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowBooking(true)}><FiCalendar /> Book Session</button>
                    </div>
                </div>
            </div>

            {success && <div className="glass-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', marginBottom: 24, color: 'var(--accent-success)' }}>✅ {success}</div>}

            {/* Available Slots */}
            {availability.length > 0 && (
                <div className="glass-card" style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>📅 Available Slots</h3>
                    <div className="grid grid-3">
                        {availability.filter((s) => !s.isBooked).map((slot, i) => (
                            <div key={i} className="stat-card">
                                <div style={{ fontWeight: 600 }}>{new Date(slot.date).toLocaleDateString()}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{slot.startTime} - {slot.endTime}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Booking Modal */}
            {showBooking && (
                <div className="modal-overlay" onClick={() => setShowBooking(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Book a Session</h2>
                        <form onSubmit={handleBook}>
                            <div className="form-group"><label>Date & Time</label><input className="form-input" type="datetime-local" value={bookingData.scheduledDate} onChange={(e) => setBookingData({ ...bookingData, scheduledDate: e.target.value })} required /></div>
                            <div className="form-group"><label>Duration (minutes)</label><select className="form-select" value={bookingData.duration} onChange={(e) => setBookingData({ ...bookingData, duration: parseInt(e.target.value) })}><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></div>
                            <div className="form-group"><label>Agenda / Topics to discuss</label><textarea className="form-textarea" value={bookingData.agenda} onChange={(e) => setBookingData({ ...bookingData, agenda: e.target.value })} placeholder="What would you like to discuss?" /></div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBooking(false)} style={{ flex: 1 }}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1 }}>Book Session</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MentorProfile;
