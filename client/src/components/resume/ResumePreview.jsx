/**
 * ResumePreview — backward-compatible wrapper. Existing call sites pass `form`
 * (which may carry `form.design` or only a legacy `form.template`). We resolve a
 * design spec and delegate to ResumeRenderer so the 3 legacy templates keep
 * working while new drafts render from AI design tokens.
 */
import ResumeRenderer from './ResumeRenderer';
import { DEFAULT_DESIGN } from './designTokens';

// Mirror of server legacyTemplateToDesign for the 3 legacy templates (display only).
const LEGACY = {
  modern:  { ...DEFAULT_DESIGN, layout: 'single-column', headingStyle: 'underline' },
  classic: { ...DEFAULT_DESIGN, layout: 'single-column', headingStyle: 'caps',
             palette: { primary: '#1f2937', accent: '#2563eb', text: '#111827', muted: '#6b7280', bg: '#ffffff', surface: '#f4f5f7' } },
  creative:{ ...DEFAULT_DESIGN, layout: 'sidebar-left', headingStyle: 'bar',
             palette: { primary: '#b91c1c', accent: '#ea580c', text: '#2a1414', muted: '#6f5a57', bg: '#ffffff', surface: '#fbf3f1' } },
};

const ResumePreview = ({ form, highlighted, editable = false, onEdit }) => {
  const design = (form && form.design && form.design.layout)
    ? form.design
    : (LEGACY[form?.template] || LEGACY.modern);
  return <ResumeRenderer design={design} form={form} highlighted={highlighted} editable={editable} onEdit={onEdit} />;
};

export default ResumePreview;
