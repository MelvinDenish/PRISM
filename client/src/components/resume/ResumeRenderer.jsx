/**
 * ResumeRenderer — token-driven, print-accurate resume render. The SAME DOM is
 * exported to PDF (Puppeteer prints an equivalent HTML; html2pdf reads
 * #resume-preview as a fallback). Two layout archetypes for the Phase-1 spike;
 * more are added once PDF fidelity is proven. Click-to-edit uses ORIGINAL array
 * indices so paths target the right entry regardless of layout.
 */
import { useState } from 'react';
import { densityScale, headingStyleCss, DEFAULT_DESIGN, SECTION_KEYS } from './designTokens';

const contactLine = (p) => [p.email, p.phone, p.location].filter(Boolean).join('  •  ');
const links = (p) => [p.linkedin, p.github, p.portfolio].filter(Boolean).join('  •  ');

const Editable = ({ value, path, onEdit, editable, style, multiline, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  if (!editable || !onEdit) return <>{value}</>;
  if (!editing) {
    return (
      <span className="rb-edit-target" title="Click to edit" style={style}
        onClick={() => { setDraft(value == null ? '' : String(value)); setEditing(true); }}>
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

const Section = ({ title, hStyle, children, highlight }) => (
  <div className={highlight ? 'rb-section-highlight' : undefined} style={{ marginBottom: 'var(--rb-gap)', borderRadius: 4 }}>
    <h3 style={hStyle}>{title}</h3>
    {children}
  </div>
);

// Render one section's body by key. `ed` is the click-to-edit factory.
function SectionBody({ keyName, form, ed, editable, accent }) {
  const p = form.personalInfo || {};
  if (keyName === 'summary') {
    if (!(p.summary || editable)) return null;
    return <p style={{ fontSize: 'var(--rb-font)' }}>{ed('personalInfo.summary', p.summary, { multiline: true, placeholder: 'Add a 2–3 sentence summary' })}</p>;
  }
  if (keyName === 'skills') {
    if (!((form.skills || []).length || editable)) return null;
    return <p style={{ fontSize: 'var(--rb-font)' }}>{editable ? ed('skills', (form.skills || []).join(', '), { multiline: true, placeholder: 'Comma-separated skills' }) : (form.skills || []).join('  •  ')}</p>;
  }
  if (keyName === 'experience') {
    if (!(form.experience || []).some((e) => e && e.company)) return null;
    return (form.experience || []).map((e, i) => (e && e.company ? (
      <div key={i} style={{ marginBottom: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 13.5 }}>{ed(`experience.${i}.position`, e.position)}{e.company ? ' — ' : ''}{ed(`experience.${i}.company`, e.company)}</strong>
          <span style={{ color: 'var(--rb-muted)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{e.startDate} – {e.current ? 'Present' : e.endDate}</span>
        </div>
        {(e.description || editable) && <p style={{ fontSize: 12.5, marginTop: 3, color: 'var(--rb-muted)' }}>{ed(`experience.${i}.description`, e.description, { multiline: true, placeholder: 'Describe impact + metrics' })}</p>}
      </div>
    ) : null));
  }
  if (keyName === 'education') {
    if (!(form.education || []).some((e) => e && e.institution)) return null;
    return (form.education || []).map((e, i) => (e && e.institution ? (
      <div key={i} style={{ marginBottom: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 13 }}>{ed(`education.${i}.degree`, e.degree)}{e.field ? ', ' : ''}{ed(`education.${i}.field`, e.field)}</strong>
          <span style={{ color: 'var(--rb-muted)', fontSize: 11.5 }}>{e.startDate} – {e.endDate}</span>
        </div>
        <p style={{ color: 'var(--rb-muted)', fontSize: 12 }}>{ed(`education.${i}.institution`, e.institution)}{e.gpa ? ` • GPA ${e.gpa}` : ''}</p>
      </div>
    ) : null));
  }
  if (keyName === 'projects') {
    if (!(form.projects || []).some((pr) => pr && pr.name)) return null;
    return (form.projects || []).map((pr, i) => (pr && pr.name ? (
      <div key={i} style={{ marginBottom: 7 }}>
        <strong style={{ fontSize: 13 }}>{ed(`projects.${i}.name`, pr.name)}</strong>
        {(pr.description || editable) && <p style={{ fontSize: 12.5, color: 'var(--rb-muted)' }}>{ed(`projects.${i}.description`, pr.description, { multiline: true, placeholder: 'What it does' })}</p>}
        {pr.technologies && <p style={{ fontSize: 11.5, color: accent }}>Tech: {ed(`projects.${i}.technologies`, pr.technologies)}</p>}
      </div>
    ) : null));
  }
  return null;
}

const ResumeRenderer = ({ design, form, highlighted, editable = false, onEdit }) => {
  const d = design && design.layout ? design : DEFAULT_DESIGN;
  const pal = d.palette || DEFAULT_DESIGN.palette;
  const ds = densityScale(d.density);
  const hStyle = headingStyleCss(d.headingStyle, pal.primary);
  const p = form.personalInfo || {};
  const hiSet = highlighted instanceof Set ? highlighted : (Array.isArray(highlighted) ? new Set(highlighted) : null);
  const hi = (k) => hiSet && hiSet.has(k);

  const ed = (path, value, opts = {}) => <Editable value={value} path={path} onEdit={onEdit} editable={editable} {...opts} />;
  const order = (d.sectionOrder && d.sectionOrder.length ? d.sectionOrder : SECTION_KEYS).filter((k) => !(d.hidden || []).includes(k));

  const sheetVars = {
    '--rb-primary': pal.primary, '--rb-accent': pal.accent, '--rb-text': pal.text,
    '--rb-muted': pal.muted, '--rb-bg': pal.bg, '--rb-surface': pal.surface,
    '--rb-gap': `${ds.gap}px`, '--rb-font': `${ds.font}px`,
  };
  const sheet = {
    ...sheetVars, background: pal.bg, color: pal.text, width: '100%', maxWidth: 820,
    minHeight: 1040, margin: '0 auto', boxSizing: 'border-box',
    fontFamily: d.fonts?.body || DEFAULT_DESIGN.fonts.body, lineHeight: 1.55, fontSize: ds.font,
  };
  const headerHi = hi('personalInfo') ? 'rb-section-highlight' : '';
  const nameNode = editable
    ? <Editable value={p.fullName} path="personalInfo.fullName" onEdit={onEdit} editable placeholder="Your Name" />
    : (p.fullName || 'Your Name');

  const Sections = () => order.map((k) => {
    const body = <SectionBody keyName={k} form={form} ed={ed} editable={editable} accent={pal.accent} />;
    if (!body || (Array.isArray(body) && body.every((x) => x === null))) return null;
    const title = k.charAt(0).toUpperCase() + k.slice(1);
    return <Section key={k} title={title} hStyle={hStyle} highlight={hi(k === 'summary' ? 'personalInfo' : k)}>{body}</Section>;
  });

  const Header = ({ inverted }) => (
    <div className={headerHi} style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 28, margin: 0, color: inverted ? pal.bg : pal.text, fontFamily: d.fonts?.heading || DEFAULT_DESIGN.fonts.heading }}>{nameNode}</h1>
      <p style={{ color: inverted ? pal.bg : pal.muted, opacity: inverted ? 0.95 : 1, fontSize: 12.5, marginTop: 5 }}>{contactLine(p)}</p>
      {links(p) && <p style={{ color: inverted ? pal.bg : pal.accent, opacity: inverted ? 0.9 : 1, fontSize: 12, marginTop: 2 }}>{links(p)}</p>}
    </div>
  );

  if (d.layout === 'sidebar-left') {
    return (
      <div id="resume-preview" style={{ ...sheet, padding: 0, display: 'flex' }}>
        <div style={{ width: 220, background: pal.surface, padding: ds.pad, boxSizing: 'border-box' }}>
          <Header />
        </div>
        <div style={{ flex: 1, padding: ds.pad, boxSizing: 'border-box' }}>
          <Sections />
        </div>
      </div>
    );
  }

  // single-column (default)
  return (
    <div id="resume-preview" style={{ ...sheet, padding: ds.pad }}>
      <div style={{ borderLeft: `5px solid ${pal.primary}`, paddingLeft: 16 }}><Header /></div>
      <Sections />
    </div>
  );
};

export default ResumeRenderer;
