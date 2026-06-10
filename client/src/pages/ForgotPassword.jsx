import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { forgotPassword } from '../services/api';
import AuthLayout from '../components/AuthLayout';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await forgotPassword(email);
            setSent(true); // Always succeeds server-side (no email enumeration).
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        }
        setLoading(false);
    };

    return (
        <AuthLayout>
                <h1>Forgot password?</h1>
                <p>Enter your email and we'll send you a reset link.</p>
                {error && <div className="error-msg">{error}</div>}
                {sent ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--accent-primary)', display: 'flex', justifyContent: 'center' }}><FiMail /></div>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            If that email is registered, a reset link has been sent. The link expires in 30 minutes.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Email</label>
                            <input className="form-input" type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                        </div>
                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                )}
                <div className="auth-link">
                    Remembered it? <Link to="/login">Back to Sign In</Link>
                </div>
        </AuthLayout>
    );
};

export default ForgotPassword;
