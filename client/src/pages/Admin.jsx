import { useState, useEffect } from 'react';
import { getAllUsers, deleteUser, getTopics, createTopic, deleteTopic, getCompanies } from '../services/api';
import { FiUsers, FiBook, FiBriefcase, FiTrash2, FiPlus, FiX, FiGrid } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import StatTile from '../components/ui/StatTile';
import SegmentedControl from '../components/ui/SegmentedControl';
import { PageSkeleton } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const Admin = () => {
    const [tab, setTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [topics, setTopics] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [showAddTopic, setShowAddTopic] = useState(false);
    const [topicForm, setTopicForm] = useState({ name: '', description: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchAll(); }, []);
    const fetchAll = async () => {
        setLoading(true);
        const [u, t, c] = await Promise.all([getAllUsers().catch(() => ({ data: { users: [] } })), getTopics(), getCompanies()]);
        setUsers(u.data.users || []);
        setTopics(t.data.topics || []);
        setCompanies(c.data.companies || []);
        setLoading(false);
    };

    const handleDeleteUser = async (id) => { if (confirm('Delete user?')) { await deleteUser(id); fetchAll(); } };
    const handleDeleteTopic = async (id) => { if (confirm('Delete topic?')) { await deleteTopic(id); fetchAll(); } };
    const handleAddTopic = async (e) => { e.preventDefault(); await createTopic(topicForm); setShowAddTopic(false); setTopicForm({ name: '', description: '' }); fetchAll(); };

    const roleColors = { admin: 'badge-danger', mentor: 'badge-primary', mentee: 'badge-success' };

    if (loading) return <PageSkeleton stats={3} cards={3} />;

    return (
        <div className="page">
            <PageHero
                eyebrow="Admin"
                title="Admin Dashboard"
                subtitle="Manage users, topics and platform content."
                icon={<FiGrid />}
            />
            <div className="grid grid-3" style={{ marginBottom: 24 }}>
                <Reveal as="div" i={0}><StatTile icon={<FiUsers />} label="Users" value={users.length} accent="primary" /></Reveal>
                <Reveal as="div" i={1}><StatTile icon={<FiBook />} label="Topics" value={topics.length} accent="secondary" /></Reveal>
                <Reveal as="div" i={2}><StatTile icon={<FiBriefcase />} label="Companies" value={companies.length} accent="action" /></Reveal>
            </div>
            <div style={{ marginBottom: 24 }}>
                <SegmentedControl
                    id="admin-tab"
                    value={tab}
                    onChange={setTab}
                    options={[{ value: 'users', label: 'Users' }, { value: 'topics', label: 'Topics' }]}
                />
            </div>

            {tab === 'users' ? (
                <Reveal as="div" className="table-container">
                    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                        <tbody>{users.map((u) => (
                            <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td><span className={`badge ${roleColors[u.role]}`}>{u.role}</span></td><td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u._id)}><FiTrash2 /></button></td></tr>
                        ))}</tbody>
                    </table>
                </Reveal>
            ) : (
                <Reveal as="div">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={() => setShowAddTopic(true)}><FiPlus /> Add Topic</button></div>
                    <div className="table-container">
                        <table><thead><tr><th>Name</th><th>Description</th><th>Created By</th><th>Actions</th></tr></thead>
                            <tbody>{topics.map((t) => (
                                <tr key={t._id}><td>{t.name}</td><td>{t.description || '-'}</td><td>{t.createdBy?.name || '-'}</td>
                                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteTopic(t._id)}><FiTrash2 /></button></td></tr>
                            ))}</tbody>
                        </table>
                    </div>
                </Reveal>
            )}
            {showAddTopic && (
                <Modal onClose={() => setShowAddTopic(false)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Topic</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAddTopic(false)}><FiX /></button></div>
                        <form onSubmit={handleAddTopic}>
                            <div className="form-group"><label>Name</label><input className="form-input" value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Topic</button>
                        </form>
                </Modal>
            )}
        </div>
    );
};

export default Admin;
