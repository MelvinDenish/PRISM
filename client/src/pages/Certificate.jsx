import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyCertificate } from '../services/api';
import { FiAward, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Brand from '../components/Brand';

// Public, logged-out certificate verification page (/certificate/:certId). Frames
// the achievement as an internal PRISM milestone — NOT an accredited credential.
const Certificate = () => {
    const { certId } = useParams();
    const [cert, setCert] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        verifyCertificate(certId)
            .then(({ data }) => { if (active) setCert(data.certificate); })
            .catch((err) => { if (active) setError(err.response?.status === 404 ? 'This certificate could not be found.' : 'Could not verify this certificate.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [certId]);

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0d0f12)', padding: 24 }}>
            <div style={{ marginBottom: 24 }}><Brand size={40} /></div>

            {loading && <div className="spinner" />}

            {!loading && error && (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', maxWidth: 480 }}>
                    <FiAlertCircle size={40} style={{ color: 'var(--accent-danger, #dc2626)', marginBottom: 16 }} />
                    <h2 style={{ fontSize: 20, marginBottom: 8 }}>Not verified</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</p>
                    <Link to="/" className="btn btn-secondary" style={{ marginTop: 20 }}>Go to PRISM</Link>
                </div>
            )}

            {!loading && cert && (
                <div className="glass-card" style={{ padding: '48px 56px', textAlign: 'center', maxWidth: 640, width: '100%', border: '1px solid var(--accent-primary)', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-primary)', color: '#fff', marginBottom: 20 }}>
                        <FiAward size={36} />
                    </div>
                    <p style={{ textTransform: 'uppercase', letterSpacing: 3, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Certificate of Completion</p>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>This certifies that</p>
                    <h1 style={{ fontSize: 34, fontWeight: 800, margin: '4px 0 12px', color: 'var(--text-primary)' }}>{cert.name}</h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
                        completed the <strong style={{ color: 'var(--accent-primary)' }}>{cert.topic}</strong> learning path
                        and passed its final test with a score of <strong>{cert.bestScore}%</strong>.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
                        <div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Issued</div><div style={{ fontWeight: 700 }}>{fmtDate(cert.issuedAt)}</div></div>
                        <div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Certificate ID</div><div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{cert.certId}</div></div>
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 28, fontSize: 13, color: 'var(--accent-success, #16a34a)' }}>
                        <FiCheckCircle /> Verified PRISM achievement
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
                        This is an internal PRISM learning achievement, not an accredited academic or professional credential.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Certificate;
