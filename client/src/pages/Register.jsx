import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

const Register = () => {
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'mentee', bio: '', skills: '', aimingCompany: '', currentCompany: '' });
    const [loading, setLoading] = useState(false);
    const { register, error } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ ...form, skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean) });
            navigate('/dashboard');
        } catch (err) { /* error in context */ }
        setLoading(false);
    };

    return (
        <AuthLayout>
                <h1>Join PRISM</h1>
                <p>Create your account and start your placement preparation.</p>
                {error && <div className="error-msg">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input className="form-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" required minLength={6} />
                    </div>
                    <div className="form-group">
                        <label>Role</label>
                        <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                            <option value="mentee">Mentee (Student)</option>
                            <option value="mentor">Mentor (Placed/Professional)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Bio</label>
                        <textarea className="form-textarea" name="bio" value={form.bio} onChange={handleChange} placeholder="Tell us about yourself..." rows={2} />
                    </div>
                    <div className="form-group">
                        <label>Skills (comma separated)</label>
                        <input className="form-input" name="skills" value={form.skills} onChange={handleChange} placeholder="React, Node.js, DSA" />
                    </div>
                    {form.role === 'mentee' && (
                        <div className="form-group">
                            <label>Target Company</label>
                            <input className="form-input" name="aimingCompany" value={form.aimingCompany} onChange={handleChange} placeholder="Google, Microsoft..." />
                        </div>
                    )}
                    {form.role === 'mentor' && (
                        <div className="form-group">
                            <label>Current Company</label>
                            <input className="form-input" name="currentCompany" value={form.currentCompany} onChange={handleChange} placeholder="Company name" />
                        </div>
                    )}
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>
                <div className="auth-link">
                    Already have an account? <Link to="/login">Sign In</Link>
                </div>
        </AuthLayout>
    );
};

export default Register;
