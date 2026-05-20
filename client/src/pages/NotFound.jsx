import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();
    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 80, marginBottom: 16 }}>🔍</div>
                <h1 style={{ fontSize: 48, fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 12 }}>404</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 24 }}>The page you're looking for doesn't exist or has been moved.</p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
            </div>
        </div>
    );
};

export default NotFound;
