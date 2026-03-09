import { useState, useEffect } from 'react';
import { getAllUsers, deleteUser, getTopics, createTopic, deleteTopic, getCompanies } from '../services/api';
import { FiUsers, FiBook, FiBriefcase, FiTrash2, FiPlus, FiX } from 'react-icons/fi';

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

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">⚙️ <span>Admin Dashboard</span></h1>
            </div>
            <div className="grid grid-3" style={{ marginBottom: 24 }}>
                <div className="stat-card"><div className="stat-label"><FiUsers /> Users</div><div className="stat-value">{users.length}</div></div>
                <div className="stat-card"><div className="stat-label"><FiBook /> Topics</div><div className="stat-value">{topics.length}</div></div>
                <div className="stat-card"><div className="stat-label"><FiBriefcase /> Companies</div><div className="stat-value">{companies.length}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {['users', 'topics'].map((t) => <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
            </div>

            {loading ? <div className="spinner" /> : tab === 'users' ? (
                <div className="table-container">
                    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                        <tbody>{users.map((u) => (
                            <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td><span className={`badge ${roleColors[u.role]}`}>{u.role}</span></td><td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u._id)}><FiTrash2 /></button></td></tr>
                        ))}</tbody>
                    </table>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={() => setShowAddTopic(true)}><FiPlus /> Add Topic</button></div>
                    <div className="table-container">
                        <table><thead><tr><th>Name</th><th>Description</th><th>Created By</th><th>Actions</th></tr></thead>
                            <tbody>{topics.map((t) => (
                                <tr key={t._id}><td>{t.name}</td><td>{t.description || '-'}</td><td>{t.createdBy?.name || '-'}</td>
                                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteTopic(t._id)}><FiTrash2 /></button></td></tr>
                            ))}</tbody>
                        </table>
                    </div>
                </div>
            )}
            {showAddTopic && (
                <div className="modal-overlay" onClick={() => setShowAddTopic(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Topic</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAddTopic(false)}><FiX /></button></div>
                        <form onSubmit={handleAddTopic}>
                            <div className="form-group"><label>Name</label><input className="form-input" value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Topic</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
