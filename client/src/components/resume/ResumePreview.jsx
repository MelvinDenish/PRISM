/**
 * ResumePreview — live, print-accurate render of a resume draft. The SAME DOM is
 * exported to PDF (html2pdf reads #resume-preview), so what you see is what you
 * get. Three visually distinct templates switch on `form.template`. Inline styles
 * with fixed colors so the sheet always looks like paper regardless of app theme.
 */
const ACCENTS = { modern: '#C9A24B', classic: '#1a1a2e', creative: '#E2682A' };

const sheet = {
    background: '#fff', color: '#2b2b2b', width: '100%', maxWidth: 820,
    minHeight: 1040, margin: '0 auto', padding: 44, boxSizing: 'border-box',
    fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.55, fontSize: 13,
};
const contactLine = (p) => [p.email, p.phone, p.location].filter(Boolean).join('  •  ');
const links = (p) => [p.linkedin, p.github, p.portfolio].filter(Boolean).join('  •  ');

const Section = ({ title, accent, children, serifCaps }) => (
    <div style={{ marginBottom: 18 }}>
        <h3 style={{
            color: accent, fontSize: 13, textTransform: 'uppercase', letterSpacing: serifCaps ? 2 : 1,
            borderBottom: `1px solid ${accent}33`, paddingBottom: 4, marginBottom: 8, fontWeight: 700,
        }}>{title}</h3>
        {children}
    </div>
);

const Body = ({ form, accent }) => {
    const p = form.personalInfo || {};
    return (
        <>
            {p.summary && <Section title="Summary" accent={accent}><p style={{ fontSize: 13 }}>{p.summary}</p></Section>}
            {(form.skills || []).length > 0 && (
                <Section title="Skills" accent={accent}>
                    <p style={{ fontSize: 13 }}>{form.skills.join('  •  ')}</p>
                </Section>
            )}
            {(form.experience || []).some(e => e.company) && (
                <Section title="Experience" accent={accent}>
                    {form.experience.filter(e => e.company).map((e, i) => (
                        <div key={i} style={{ marginBottom: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <strong style={{ fontSize: 13.5 }}>{e.position}{e.company ? ` — ${e.company}` : ''}</strong>
                                <span style={{ color: '#888', fontSize: 11.5, whiteSpace: 'nowrap' }}>{e.startDate} – {e.current ? 'Present' : e.endDate}</span>
                            </div>
                            {e.description && <p style={{ fontSize: 12.5, marginTop: 3, color: '#555' }}>{e.description}</p>}
                        </div>
                    ))}
                </Section>
            )}
            {(form.education || []).some(e => e.institution) && (
                <Section title="Education" accent={accent}>
                    {form.education.filter(e => e.institution).map((e, i) => (
                        <div key={i} style={{ marginBottom: 7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <strong style={{ fontSize: 13 }}>{e.degree}{e.field ? `, ${e.field}` : ''}</strong>
                                <span style={{ color: '#888', fontSize: 11.5 }}>{e.startDate} – {e.endDate}</span>
                            </div>
                            <p style={{ color: '#666', fontSize: 12 }}>{e.institution}{e.gpa ? ` • GPA ${e.gpa}` : ''}</p>
                        </div>
                    ))}
                </Section>
            )}
            {(form.projects || []).some(p => p.name) && (
                <Section title="Projects" accent={accent}>
                    {form.projects.filter(pr => pr.name).map((pr, i) => (
                        <div key={i} style={{ marginBottom: 7 }}>
                            <strong style={{ fontSize: 13 }}>{pr.name}</strong>
                            {pr.description && <p style={{ fontSize: 12.5, color: '#666' }}>{pr.description}</p>}
                            {pr.technologies && <p style={{ fontSize: 11.5, color: accent }}>Tech: {pr.technologies}</p>}
                        </div>
                    ))}
                </Section>
            )}
        </>
    );
};

const ResumePreview = ({ form }) => {
    const accent = ACCENTS[form.template] || ACCENTS.modern;
    const p = form.personalInfo || {};
    const name = p.fullName || 'Your Name';

    // CREATIVE: bold full-width colored header band.
    if (form.template === 'creative') {
        return (
            <div id="resume-preview" style={sheet}>
                <div style={{ background: accent, color: '#fff', margin: -44, marginBottom: 24, padding: '32px 44px' }}>
                    <h1 style={{ fontSize: 30, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: -0.5 }}>{name}</h1>
                    <p style={{ fontSize: 12.5, marginTop: 6, opacity: 0.95 }}>{contactLine(p)}</p>
                    {links(p) && <p style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>{links(p)}</p>}
                </div>
                <Body form={form} accent={accent} />
            </div>
        );
    }

    // CLASSIC: centered, serif, restrained.
    if (form.template === 'classic') {
        return (
            <div id="resume-preview" style={sheet}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a2e', paddingBottom: 14, marginBottom: 20 }}>
                    <h1 style={{ fontSize: 28, margin: 0, letterSpacing: 1, color: '#1a1a2e' }}>{name}</h1>
                    <p style={{ color: '#555', fontSize: 12.5, marginTop: 6 }}>{contactLine(p)}</p>
                    {links(p) && <p style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{links(p)}</p>}
                </div>
                <Body form={form} accent={accent} serifCaps />
            </div>
        );
    }

    // MODERN (default): accent name + side rule.
    return (
        <div id="resume-preview" style={sheet}>
            <div style={{ borderLeft: `5px solid ${accent}`, paddingLeft: 16, marginBottom: 22 }}>
                <h1 style={{ fontSize: 28, margin: 0, color: '#1a1a2e', fontFamily: 'Helvetica, Arial, sans-serif' }}>{name}</h1>
                <p style={{ color: '#666', fontSize: 12.5, marginTop: 5 }}>{contactLine(p)}</p>
                {links(p) && <p style={{ color: accent, fontSize: 12, marginTop: 2 }}>{links(p)}</p>}
            </div>
            <Body form={form} accent={accent} />
        </div>
    );
};

export default ResumePreview;
