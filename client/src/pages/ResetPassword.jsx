import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../services/api';

const ResetPassword = () => {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        setLoading(true);
        try {
            await resetPassword(token, password);
            navigate('/login?reset=1');
        } catch (err) {
            setError(err.response?.data?.details?.[0] || err.response?.data?.message || 'Reset failed. The link may have expired.');
        }
        setLoading(false);
    };

    if (!token) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <h1>PRISM</h1>
                    <div className="error-msg">Missing or invalid reset link.</div>
                    <div className="auth-link"><Link to="/forgot-password">Request a new link</Link></div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>PRISM</h1>
                <p>Choose a new password (at least 8 characters, including a letter and a number).</p>
                {error && <div className="error-msg">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>New Password</label>
                        <input className="form-input" type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input className="form-input" type="password" value={confirm}
                            onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
                <div className="auth-link">
                    <Link to="/login">Back to Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
