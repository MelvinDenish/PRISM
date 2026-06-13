/**
 * ResumePreview — live, print-accurate render of a resume draft. The SAME DOM is
 * exported to PDF (html2pdf reads #resume-preview), so what you see is what you
 * get. Three visually distinct templates switch on `form.template`. Inline styles
 * with fixed colors so the sheet always looks like paper regardless of app theme.
 *
 * P7 click-to-edit: when `editable` + `onEdit(path, value)` are passed, text spans
 * become click-to-edit. `path` uses ORIGINAL array indices (not the filtered ones)
 * so `experience.2.description` always targets the right entry. When not editable
 * (export / wizard preview) the DOM is plain text — identical to before.
 */
import { useState } from 'react';

const ACCENTS = { modern: '#C9A24B', classic: '#1a1a2e', creative: '#E2682A' };

const sheet = {
    background: '#fff', color: '#2b2b2b', width: '100%', maxWidth: 820,
    minHeight: 1040, margin: '0 auto', padding: 44, boxSizing: 'border-box',
    fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.55, fontSize: 13,
};
const contactLine = (p) => [p.email, p.phone, p.location].filter(Boolean).join('  •  ');
const links = (p) => [p.linkedin, p.github, p.portfolio].filter(Boolean).join('  •  ');

// Inline click-to-edit text. Read-only render is plain text (clean for export).
const Editable = ({ value, path, onEdit, editable, style, multiline, placeholder }) => {
    const [editing, setEditing] = useState(false);
    // `draft` is seeded fresh from `value` each time edit mode starts (see the
    // onClick below), so no effect is needed to track external value changes —
    // mid-edit prop changes intentionally don't clobber the user's typing.
    const [draft, setDraft] = useState(value == null ? '' : String(value));

    if (!editable || !onEdit) return <>{value}</>;

    if (!editing) {
        return (
            <span
                className="rb-edit-target"
                title="Click to edit"
                style={style}
                onClick={() => { setDraft(value == null ? '' : String(value)); setEditing(true); }}
            >
                {value || <span style={{ opacity: 0.4 }}>{placeholder || 'Click to add'}</span>}
            </span>
        );
    }

    const commit = () => { setEditing(false); if (draft !== (value == null ? '' : String(value))) onEdit(path, draft); };
    const common = {
        autoFocus: true, className: 'rb-edit-input', value: draft, style,
        onChange: (e) => setDraft(e.target.value), onBlur: commit,
        onKeyDown: (e) => {
            if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
        },
    };
    return multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
};

const Section = ({ title, accent, children, serifCaps, highlight }) => (
    <div className={highlight ? 'rb-section-highlight' : undefined} style={{ marginBottom: 18, borderRadius: 4 }}>
        <h3 style={{
            color: accent, fontSize: 13, textTransform: 'uppercase', letterSpacing: serifCaps ? 2 : 1,
            borderBottom: `1px solid ${accent}33`, paddingBottom: 4, marginBottom: 8, fontWeight: 700,
        }}>{title}</h3>
        {children}
    </div>
);

const Body = ({ form, accent, highlighted, serifCaps, editable, onEdit }) => {
    const p = form.personalInfo || {};
    const hi = (key) => highlighted && highlighted.has(key);
    const ed = (path, value, opts = {}) => (
        <Editable value={value} path={path} onEdit={onEdit} editable={editable} {...opts} />
    );
    return (
        <>
            {(p.summary || editable) && (
                <Section title="Summary" accent={accent} serifCaps={serifCaps} highlight={hi('personalInfo')}>
                    <p style={{ fontSize: 13 }}>{ed('personalInfo.summary', p.summary, { multiline: true, placeholder: 'Add a 2–3 sentence summary' })}</p>
                </Section>
            )}
            {((form.skills || []).length > 0 || editable) && (
                <Section title="Skills" accent={accent} serifCaps={serifCaps} highlight={hi('skills')}>
                    <p style={{ fontSize: 13 }}>
                        {editable
                            ? ed('skills', (form.skills || []).join(', '), { multiline: true, placeholder: 'Comma-separated skills' })
                            : (form.skills || []).join('  •  ')}
                    </p>
                </Section>
            )}
            {(form.experience || []).some((e) => e.company) && (
                <Section title="Experience" accent={accent} serifCaps={serifCaps} highlight={hi('experience')}>
                    {(form.experience || []).map((e, i) => (e && e.company ? (
                        <div key={i} style={{ marginBottom: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <strong style={{ fontSize: 13.5 }}>
                                    {ed(`experience.${i}.position`, e.position)}{e.company ? ' — ' : ''}{ed(`experience.${i}.company`, e.company)}
                                </strong>
                                <span style={{ color: '#888', fontSize: 11.5, whiteSpace: 'nowrap' }}>{e.startDate} – {e.current ? 'Present' : e.endDate}</span>
                            </div>
                            {(e.description || editable) && <p style={{ fontSize: 12.5, marginTop: 3, color: '#555' }}>{ed(`experience.${i}.description`, e.description, { multiline: true, placeholder: 'Describe impact + metrics' })}</p>}
                        </div>
                    ) : null))}
                </Section>
            )}
            {(form.education || []).some((e) => e.institution) && (
                <Section title="Education" accent={accent} serifCaps={serifCaps} highlight={hi('education')}>
                    {(form.education || []).map((e, i) => (e && e.institution ? (
                        <div key={i} style={{ marginBottom: 7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <strong style={{ fontSize: 13 }}>{ed(`education.${i}.degree`, e.degree)}{e.field ? ', ' : ''}{ed(`education.${i}.field`, e.field)}</strong>
                                <span style={{ color: '#888', fontSize: 11.5 }}>{e.startDate} – {e.endDate}</span>
                            </div>
                            <p style={{ color: '#666', fontSize: 12 }}>{ed(`education.${i}.institution`, e.institution)}{e.gpa ? ` • GPA ${e.gpa}` : ''}</p>
                        </div>
                    ) : null))}
                </Section>
            )}
            {(form.projects || []).some((pr) => pr.name) && (
                <Section title="Projects" accent={accent} serifCaps={serifCaps} highlight={hi('projects')}>
                    {(form.projects || []).map((pr, i) => (pr && pr.name ? (
                        <div key={i} style={{ marginBottom: 7 }}>
                            <strong style={{ fontSize: 13 }}>{ed(`projects.${i}.name`, pr.name)}</strong>
                            {(pr.description || editable) && <p style={{ fontSize: 12.5, color: '#666' }}>{ed(`projects.${i}.description`, pr.description, { multiline: true, placeholder: 'What it does' })}</p>}
                            {pr.technologies && <p style={{ fontSize: 11.5, color: accent }}>Tech: {ed(`projects.${i}.technologies`, pr.technologies)}</p>}
                        </div>
                    ) : null))}
                </Section>
            )}
        </>
    );
};

const ResumePreview = ({ form, highlighted, editable = false, onEdit }) => {
    const accent = ACCENTS[form.template] || ACCENTS.modern;
    const p = form.personalInfo || {};
    const name = p.fullName || 'Your Name';
    const hiSet = highlighted instanceof Set
      ? highlighted
      : (Array.isArray(highlighted) ? new Set(highlighted) : null);
    const headerHi = hiSet && hiSet.has('personalInfo') ? 'rb-section-highlight' : '';
    const nameNode = editable
        ? <Editable value={p.fullName} path="personalInfo.fullName" onEdit={onEdit} editable placeholder="Your Name" />
        : name;
    const bodyProps = { form, accent, highlighted: hiSet, editable, onEdit };

    // CREATIVE: bold full-width colored header band.
    if (form.template === 'creative') {
        return (
            <div id="resume-preview" style={sheet}>
                <div className={headerHi} style={{ background: accent, color: '#fff', margin: -44, marginBottom: 24, padding: '32px 44px' }}>
                    <h1 style={{ fontSize: 30, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: -0.5 }}>{nameNode}</h1>
                    <p style={{ fontSize: 12.5, marginTop: 6, opacity: 0.95 }}>{contactLine(p)}</p>
                    {links(p) && <p style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>{links(p)}</p>}
                </div>
                <Body {...bodyProps} />
            </div>
        );
    }

    // CLASSIC: centered, serif, restrained.
    if (form.template === 'classic') {
        return (
            <div id="resume-preview" style={sheet}>
                <div className={headerHi} style={{ textAlign: 'center', borderBottom: '2px solid #1a1a2e', paddingBottom: 14, marginBottom: 20 }}>
                    <h1 style={{ fontSize: 28, margin: 0, letterSpacing: 1, color: '#1a1a2e' }}>{nameNode}</h1>
                    <p style={{ color: '#555', fontSize: 12.5, marginTop: 6 }}>{contactLine(p)}</p>
                    {links(p) && <p style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{links(p)}</p>}
                </div>
                <Body {...bodyProps} serifCaps />
            </div>
        );
    }

    // MODERN (default): accent name + side rule.
    return (
        <div id="resume-preview" style={sheet}>
            <div className={headerHi} style={{ borderLeft: `5px solid ${accent}`, paddingLeft: 16, marginBottom: 22 }}>
                <h1 style={{ fontSize: 28, margin: 0, color: '#1a1a2e', fontFamily: 'Helvetica, Arial, sans-serif' }}>{nameNode}</h1>
                <p style={{ color: '#666', fontSize: 12.5, marginTop: 5 }}>{contactLine(p)}</p>
                {links(p) && <p style={{ color: accent, fontSize: 12, marginTop: 2 }}>{links(p)}</p>}
            </div>
            <Body {...bodyProps} />
        </div>
    );
};

export default ResumePreview;
