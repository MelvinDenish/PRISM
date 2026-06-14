const nodemailer = require('nodemailer');

// Escape user-controlled values before interpolating into HTML emails (Phase 1).
// Prevents HTML/script injection from fields like a mentee's name or agenda.
const escapeHtml = (value) =>
    String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const createTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ Email credentials not set. Email notifications disabled.');
        return null;
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
};

const sendSessionRequestEmail = async (mentorEmail, mentorName, menteeInfo) => {
    const transporter = createTransporter();
    if (!transporter) return { success: false, message: 'Email not configured' };

    try {
        await transporter.sendMail({
            from: `"PRISM Platform" <${process.env.EMAIL_USER}>`,
            to: mentorEmail,
            subject: `🔔 New Session Request from ${menteeInfo.name}`,
            html: `
                <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0a1a1c; color: #e2e8f0; border-radius: 16px;">
                    <h1 style="color: #10b981; font-size: 24px;">PRISM</h1>
                    <h2 style="color: #e2e8f0; font-size: 18px; margin-top: 16px;">New Session Request</h2>
                    <p style="color: #94a3b8;">Hi ${escapeHtml(mentorName)},</p>
                    <p style="color: #94a3b8;"><strong style="color: #e2e8f0;">${escapeHtml(menteeInfo.name)}</strong> has requested a mentorship session with you.</p>
                    ${menteeInfo.agenda ? `<p style="color: #94a3b8;"><strong>Agenda:</strong> ${escapeHtml(menteeInfo.agenda)}</p>` : ''}
                    ${menteeInfo.scheduledDate ? `<p style="color: #94a3b8;"><strong>Requested Date:</strong> ${new Date(menteeInfo.scheduledDate).toLocaleString()}</p>` : ''}
                    ${menteeInfo.durationMinutes ? `<p style="color: #94a3b8;"><strong>Duration:</strong> ${escapeHtml(menteeInfo.durationMinutes)} minutes</p>` : ''}
                    <p style="color: #94a3b8;">Sign in to review and <strong style="color: #e2e8f0;">approve or decline</strong> this request.</p>
                    <a href="${(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()}/sessions" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #10b981, #14b8a6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View &amp; Respond</a>
                    <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— PRISM Platform</p>
                </div>`
        });
        return { success: true };
    } catch (err) {
        console.error('Email error:', err);
        return { success: false, message: err.message };
    }
};

const sendPasswordResetEmail = async (toEmail, name, resetUrl) => {
    const transporter = createTransporter();
    if (!transporter) return { success: false, message: 'Email not configured' };

    try {
        await transporter.sendMail({
            from: `"PRISM Platform" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: '🔑 Reset your PRISM password',
            html: `
                <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0a1a1c; color: #e2e8f0; border-radius: 16px;">
                    <h1 style="color: #10b981; font-size: 24px;">PRISM</h1>
                    <h2 style="color: #e2e8f0; font-size: 18px; margin-top: 16px;">Password Reset</h2>
                    <p style="color: #94a3b8;">Hi ${escapeHtml(name)},</p>
                    <p style="color: #94a3b8;">We received a request to reset your password. This link expires in 30 minutes. If you didn't request it, you can safely ignore this email.</p>
                    <a href="${resetUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #10b981, #14b8a6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
                    <p style="color: #64748b; font-size: 12px; margin-top: 24px;">— PRISM Platform</p>
                </div>`
        });
        return { success: true };
    } catch (err) {
        console.error('Email error:', err);
        return { success: false, message: err.message };
    }
};

module.exports = { sendSessionRequestEmail, sendPasswordResetEmail };
