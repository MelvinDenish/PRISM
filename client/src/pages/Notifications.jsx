import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';
import { FiCheck, FiCheckCircle, FiBell } from 'react-icons/fi';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchNotifications(); }, []);

    const fetchNotifications = async () => {
        try {
            const res = await getNotifications();
            setNotifications(res.data.notifications || []);
            setUnread(res.data.unreadCount || 0);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleMarkRead = async (id) => {
        await markNotificationRead(id);
        fetchNotifications();
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead();
        fetchNotifications();
    };

    const icons = { session: '📅', mock: '🎤', resource: '📚', general: '🔔' };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🔔 <span>Notifications</span></h1>
                {unread > 0 && <button className="btn btn-secondary" onClick={handleMarkAllRead}><FiCheckCircle /> Mark all read</button>}
            </div>
            {loading ? <div className="spinner" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {notifications.map((n) => (
                        <div key={n._id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', opacity: n.isRead ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span style={{ fontSize: 24 }}>{icons[n.type] || '🔔'}</span>
                                <div>
                                    <p style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 14 }}>{n.message}</p>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            {!n.isRead && <button className="btn btn-sm btn-secondary" onClick={() => handleMarkRead(n._id)}><FiCheck /></button>}
                        </div>
                    ))}
                    {notifications.length === 0 && <div className="empty-state"><div className="icon"><FiBell /></div><p>No notifications yet</p></div>}
                </div>
            )}
        </div>
    );
};

export default Notifications;
