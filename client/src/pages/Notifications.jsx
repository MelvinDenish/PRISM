import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';
import { FiCheck, FiCheckCircle, FiBell, FiCalendar, FiMic, FiBook } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';

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

    const icons = { session: <FiCalendar />, mock: <FiMic />, resource: <FiBook />, general: <FiBell /> };

    return (
        <div className="page">
            <PageHero
                eyebrow="Activity"
                title="Notifications"
                subtitle={unread > 0 ? `${unread} unread update${unread === 1 ? '' : 's'}.` : 'You are all caught up.'}
                icon={<FiBell />}
                actions={unread > 0 && <button className="btn btn-secondary" onClick={handleMarkAllRead}><FiCheckCircle /> Mark all read</button>}
            />
            {loading ? <SkeletonGrid count={5} cols={1} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {notifications.map((n, i) => (
                        <Reveal as="div" key={n._id} i={i} className="glass-card spotlight" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', opacity: n.isRead ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span className="notif-icon" data-read={n.isRead ? '1' : '0'}>{icons[n.type] || <FiBell />}</span>
                                <div>
                                    <p style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 14 }}>{n.message}</p>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            {!n.isRead && <button className="btn btn-sm btn-secondary" onClick={() => handleMarkRead(n._id)}><FiCheck /></button>}
                        </Reveal>
                    ))}
                    {notifications.length === 0 && <div className="empty-state"><div className="icon"><FiBell /></div><p>No notifications yet</p></div>}
                </div>
            )}
        </div>
    );
};

export default Notifications;
