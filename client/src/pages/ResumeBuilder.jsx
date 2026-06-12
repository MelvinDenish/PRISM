import { useState, useEffect, useRef } from 'react';
import { getResumeDrafts, saveResumeDraft, updateResumeDraft, deleteResumeDraft, generateResumeContent, generateCoverLetter, generateResumeDraft, refineResumeDraft, exportResumeDraft, downloadArtifact, getResumeDraft } from '../services/api';
import { FiPlus, FiTrash2, FiDownload, FiZap, FiFileText, FiEdit, FiSave, FiArrowLeft, FiFile, FiSliders, FiSend } from 'react-icons/fi';
import { saveAs } from 'file-saver';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import ResumePreview from '../components/resume/ResumePreview';

const TEMPLATES = [
    { id: 'modern', name: 'Modern', desc: 'Clean layout with accent colors', color: '#C9A24B' },
    { id: 'classic', name: 'Classic', desc: 'Traditional format for corporates', color: '#A8843A' },
    { id: 'creative', name: 'Creative', desc: 'Bold design for startups', color: '#E2682A' },
];

const ResumeBuilder = () => {
    const [drafts, setDrafts] = useState([]);
    const [current, setCurrent] = useState(null);
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [coverLetterGen, setCoverLetterGen] = useState(false);
    const [aiSuccess, setAiSuccess] = useState('');
    const [form, setForm] = useState({
        name: 'My Resume', template: 'modern',
        personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', summary: '' },
        education: [{ institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '' }],
        experience: [{ company: '', position: '', startDate: '', endDate: '', current: false, description: '' }],
        skills: [], projects: [{ name: '', description: '', technologies: '', link: '' }],
        coverLetter: { template: 'professional', content: '', jobTitle: '', companyName: '' },
        jobDescription: ''
    });
    const [skillInput, setSkillInput] = useState('');
    // ── Canvas (Copilot P3) state ──
    const [canvasJD, setCanvasJD] = useState('');
    const [canvasGenerating, setCanvasGenerating] = useState(false);
    const [canvasRefining, setCanvasRefining] = useState(false);
    const [canvasInstruction, setCanvasInstruction] = useState('');
    const [canvasError, setCanvasError] = useState('');
    const [canvasChanged, setCanvasChanged] = useState([]);
    const [canvasExporting, setCanvasExporting] = useState(null); // 'pdf' | 'docx' | null
    const highlightTimer = useRef(null);

    useEffect(() => { loadDrafts(); }, []);
    useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); }, []);

    // Hydrate the form (the editor + preview share this shape) from a saved draft.
    const hydrateForm = (draft) => ({
        name: draft.name || 'My Resume',
        template: draft.template || 'modern',
        personalInfo: draft.personalInfo || { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', summary: '' },
        education: draft.education?.length ? draft.education : [{ institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '' }],
        experience: draft.experience?.length ? draft.experience : [{ company: '', position: '', startDate: '', endDate: '', current: false, description: '' }],
        skills: draft.skills || [],
        projects: draft.projects?.length ? draft.projects : [{ name: '', description: '', technologies: '', link: '' }],
        coverLetter: draft.coverLetter || { template: 'professional', content: '', jobTitle: '', companyName: '' },
        jobDescription: draft.jobDescription || '',
    });

    const loadDrafts = async () => {
        try { const { data } = await getResumeDrafts(); setDrafts(data.drafts || []); } catch {}
    };

    const blankForm = () => ({
        name: 'My Resume', template: 'modern',
        personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', summary: '' },
        education: [{ institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '' }],
        experience: [{ company: '', position: '', startDate: '', endDate: '', current: false, description: '' }],
        skills: [], projects: [{ name: '', description: '', technologies: '', link: '' }],
        coverLetter: { template: 'professional', content: '', jobTitle: '', companyName: '' },
        jobDescription: ''
    });

    // New blank draft → land on the canvas (preferred flow).
    const newDraft = () => {
        setCurrent(null);
        setForm(blankForm());
        setCanvasJD('');
        setCanvasInstruction('');
        setCanvasChanged([]);
        setCanvasError('');
        setStep('canvas');
    };

    const editDraft = (draft) => {
        setCurrent(draft._id);
        setForm(hydrateForm(draft));
        // Land on the canvas (live preview + NL refine). Advanced toggle goes to step 1.
        setStep('canvas');
        setCanvasJD(draft.jobDescription || '');
        setCanvasInstruction('');
        setCanvasChanged([]);
        setCanvasError('');
    };

    // Returns the draft id (existing or newly created) so callers that need it
    // immediately — e.g. export — don't have to wait for the async setCurrent.
    const saveDraft = async () => {
        setLoading(true);
        let id = current;
        try {
            if (current) { await updateResumeDraft(current, form); }
            else { const { data } = await saveResumeDraft(form); id = data.draft._id; setCurrent(id); }
            loadDrafts();
        } catch (err) { console.error(err); }
        setLoading(false);
        return id;
    };

    const removeDraft = async (id) => {
        try { await deleteResumeDraft(id); loadDrafts(); } catch {}
    };

    const aiGenerate = async () => {
        setGenerating(true);
        setAiSuccess('');
        try {
            const { data } = await generateResumeContent({ personalInfo: form.personalInfo, education: form.education, experience: form.experience, skills: form.skills, projects: form.projects, jobDescription: form.jobDescription });
            if (data.generated) {
                setForm(prev => {
                    const updated = { ...prev };
                    // Apply summary
                    if (data.generated.summary && typeof data.generated.summary === 'string') {
                        updated.personalInfo = { ...prev.personalInfo, summary: data.generated.summary };
                    }
                    // Apply optimized skills (ensure they're individual strings)
                    if (data.generated.skillsOptimized && Array.isArray(data.generated.skillsOptimized)) {
                        updated.skills = data.generated.skillsOptimized.filter(s => typeof s === 'string' && s.length < 50);
                    }
                    // Apply improved experience descriptions
                    if (data.generated.experienceDescriptions && Array.isArray(data.generated.experienceDescriptions)) {
                        updated.experience = prev.experience.map((exp, i) => {
                            const ai = data.generated.experienceDescriptions[i];
                            if (ai && typeof ai === 'object' && ai.description) {
                                return { ...exp, description: ai.description, position: ai.position || exp.position };
                            } else if (ai && typeof ai === 'string') {
                                return { ...exp, description: ai };
                            }
                            return exp;
                        });
                    }
                    return updated;
                });
                setAiSuccess('✅ Resume optimized! Summary, skills & experience updated.');
                setTimeout(() => setAiSuccess(''), 5000);
            }
        } catch (err) { setAiSuccess('❌ AI optimization failed. Try again.'); setTimeout(() => setAiSuccess(''), 4000); }
        setGenerating(false);
    };

    const aiCoverLetter = async () => {
        setCoverLetterGen(true);
        try {
            const { data } = await generateCoverLetter({ personalInfo: form.personalInfo, jobTitle: form.coverLetter.jobTitle, companyName: form.coverLetter.companyName, jobDescription: form.jobDescription, skills: form.skills });
            setForm(prev => ({ ...prev, coverLetter: { ...prev.coverLetter, content: data.coverLetter } }));
        } catch {}
        setCoverLetterGen(false);
    };

    // ── Canvas (Copilot P3) handlers ──

    // Briefly flash the named sections in the preview after a refine.
    const flashChanged = (sections) => {
        if (!Array.isArray(sections) || sections.length === 0) return;
        setCanvasChanged(sections);
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setCanvasChanged([]), 2200);
    };

    // "Generate from my profile" — server pulls the User profile + canvasJD,
    // persists a new ResumeDraft, returns it. We hydrate the form so the preview
    // and the (hidden) wizard reflect the new draft.
    const generateFromProfile = async () => {
        setCanvasGenerating(true);
        setCanvasError('');
        try {
            const { data } = await generateResumeDraft({ jobDescription: canvasJD || undefined });
            if (!data?.draft) throw new Error('No draft returned');
            setCurrent(data.draft._id);
            setForm(hydrateForm(data.draft));
            setCanvasJD(data.draft.jobDescription || canvasJD || '');
            loadDrafts();
            flashChanged(['personalInfo', 'experience', 'skills', 'projects', 'education']);
        } catch (err) {
            setCanvasError(err?.response?.data?.message || err.message || 'Could not generate resume.');
        }
        setCanvasGenerating(false);
    };

    // NL refine — POST to /drafts/:id/refine, update form in place,
    // highlight the sections the server says changed.
    const refineWithInstruction = async () => {
        if (!current) {
            setCanvasError('Save or generate a draft first.');
            return;
        }
        const instruction = canvasInstruction.trim();
        if (instruction.length < 1 || instruction.length > 500) {
            setCanvasError('Instruction must be 1–500 characters.');
            return;
        }
        setCanvasRefining(true);
        setCanvasError('');
        try {
            const { data } = await refineResumeDraft(current, instruction);
            if (!data?.draft) throw new Error('No draft returned');
            setForm(hydrateForm(data.draft));
            flashChanged(data.changedSections || []);
            setCanvasInstruction('');
        } catch (err) {
            setCanvasError(err?.response?.data?.message || err.message || 'Refinement failed.');
        }
        setCanvasRefining(false);
    };

    // Server-rendered export → real .docx/.pdf via the generateDocument pipeline,
    // then trigger a browser download through the existing downloadArtifact helper.
    const exportViaServer = async (fmt) => {
        // saveDraft returns the id synchronously (setCurrent is async, so reading
        // `current` here would still be null on a first-time export).
        let id = current;
        if (!id) {
            try { id = await saveDraft(); } catch { /* surfaced below */ }
        }
        if (!id) {
            setCanvasError('Could not save the draft to export.');
            return;
        }
        setCanvasExporting(fmt);
        setCanvasError('');
        try {
            const { data } = await exportResumeDraft(id, fmt);
            if (!data?.artifact?.id) throw new Error('No artifact returned');
            const filename = `${form.personalInfo?.fullName || form.name || 'resume'}.${fmt}`;
            await downloadArtifact(data.artifact.id, filename);
        } catch (err) {
            setCanvasError(err?.response?.data?.message || err.message || `${fmt.toUpperCase()} export failed.`);
        }
        setCanvasExporting(null);
    };

    // Refresh the form from server in case mid-canvas state drifted (used after
    // entering the manual wizard and coming back). Best-effort; silent on fail.
    const reloadCurrentDraft = async () => {
        if (!current) return;
        try {
            const { data } = await getResumeDraft(current);
            if (data?.draft) setForm(hydrateForm(data.draft));
        } catch { /* noop */ }
    };

    const updatePersonal = (key, val) => setForm(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [key]: val } }));
    const addSkill = () => { if (skillInput.trim()) { setForm(prev => ({ ...prev, skills: [...prev.skills, skillInput.trim()] })); setSkillInput(''); } };
    const removeSkill = (i) => setForm(prev => ({ ...prev, skills: prev.skills.filter((_, idx) => idx !== i) }));
    const updateArr = (field, index, key, val) => setForm(prev => { const arr = [...prev[field]]; arr[index] = { ...arr[index], [key]: val }; return { ...prev, [field]: arr }; });
    const addArr = (field, template) => setForm(prev => ({ ...prev, [field]: [...prev[field], template] }));

    const downloadPDF = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const el = document.getElementById('resume-preview');
        if (!el) return;
        html2pdf().set({ margin: 10, filename: `${form.personalInfo.fullName || 'resume'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save();
    };

    const downloadDOCX = async () => {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
        const doc = new Document({ sections: [{ children: [
            new Paragraph({ children: [new TextRun({ text: form.personalInfo.fullName, bold: true, size: 32 })], heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: `${form.personalInfo.email} | ${form.personalInfo.phone} | ${form.personalInfo.location}`, size: 20 })] }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'SUMMARY', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ children: [new TextRun({ text: form.personalInfo.summary || '', size: 20 })] }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'SKILLS', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ children: [new TextRun({ text: form.skills.join(', '), size: 20 })] }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'EXPERIENCE', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }),
            ...form.experience.flatMap(e => [
                new Paragraph({ children: [new TextRun({ text: `${e.position} at ${e.company}`, bold: true, size: 22 })] }),
                new Paragraph({ children: [new TextRun({ text: `${e.startDate} - ${e.current ? 'Present' : e.endDate}`, italics: true, size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: e.description || '', size: 20 })] }),
                new Paragraph({ text: '' }),
            ]),
            new Paragraph({ children: [new TextRun({ text: 'EDUCATION', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }),
            ...form.education.flatMap(e => [
                new Paragraph({ children: [new TextRun({ text: `${e.degree} in ${e.field}`, bold: true, size: 22 })] }),
                new Paragraph({ children: [new TextRun({ text: `${e.institution} | ${e.startDate} - ${e.endDate} ${e.gpa ? `| GPA: ${e.gpa}` : ''}`, size: 18 })] }),
                new Paragraph({ text: '' }),
            ]),
            new Paragraph({ children: [new TextRun({ text: 'PROJECTS', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }),
            ...form.projects.flatMap(p => [
                new Paragraph({ children: [new TextRun({ text: p.name, bold: true, size: 22 })] }),
                new Paragraph({ children: [new TextRun({ text: p.description, size: 20 })] }),
                new Paragraph({ children: [new TextRun({ text: `Technologies: ${p.technologies}`, italics: true, size: 18 })] }),
                new Paragraph({ text: '' }),
            ]),
        ]}]});
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${form.personalInfo.fullName || 'resume'}.docx`);
    };

    const tc = TEMPLATES.find(t => t.id === form.template)?.color || '#4F46E5';

    // LIST VIEW
    if (step === 0) {
        return (
            <div className="page">
                <PageHero
                    eyebrow="Career"
                    title="Resume Builder"
                    subtitle="Build a recruiter-ready resume with AI-assisted content."
                    icon={<FiFileText />}
                    actions={<button className="btn btn-action" onClick={newDraft}><FiPlus /> New Resume</button>}
                />
                {drafts.length === 0 ? (
                    <div className="empty-state"><div className="icon"><FiFileText /></div><p>No resumes yet. Create your first one!</p></div>
                ) : (
                    <div className="grid grid-3">
                        {drafts.map((d, i) => (
                            <Reveal as="div" key={d._id} i={i} className="glass-card spotlight" style={{ cursor: 'pointer' }} onClick={() => editDraft(d)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div><h3 style={{ fontSize: 16 }}>{d.name}</h3><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.template} template</p></div>
                                    <button className="btn btn-sm" style={{ background: 'none', color: 'var(--accent-danger)' }} onClick={e => { e.stopPropagation(); removeDraft(d._id); }}><FiTrash2 /></button>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{d.personalInfo?.fullName || 'No name'}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>Updated: {new Date(d.updatedAt).toLocaleDateString()}</p>
                            </Reveal>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // CANVAS VIEW (Copilot P3) — generate from profile, NL refine, live preview, export.
    // This is the primary edit surface; the legacy step wizard is reachable via the
    // "Advanced: manual editor" toggle.
    if (step === 'canvas') {
        const refineDisabled = canvasRefining || canvasGenerating || !canvasInstruction.trim();
        return (
            <div className="page">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setStep(0)}><FiArrowLeft /> Back</button>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{form.name || 'New Resume'}</h2>
                    <button
                        className="btn btn-secondary btn-sm"
                        title="Open the step-by-step editor"
                        onClick={async () => { await reloadCurrentDraft(); setStep(1); }}
                    ><FiSliders /> Advanced: manual editor</button>
                    <button className="btn btn-primary btn-sm" onClick={saveDraft} disabled={loading}><FiSave /> {loading ? 'Saving…' : 'Save'}</button>
                </div>

                <div className="rb-layout">
                    <div className="rb-editor">
                        <div className="glass-card" style={{ marginBottom: 16 }}>
                            <h3 className="card-title" style={{ marginBottom: 8 }}><FiZap /> Generate from my profile</h3>
                            <p className="rb-canvas-help">We pull your saved profile (skills, experience, education) and tailor it to the job description below. Leave the JD blank for a general resume.</p>
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label>Job description (optional)</label>
                                <textarea
                                    className="form-textarea rb-canvas-jd"
                                    rows={4}
                                    value={canvasJD}
                                    onChange={e => setCanvasJD(e.target.value)}
                                    placeholder="Paste the role you're targeting, or leave blank for a general resume."
                                />
                            </div>
                            <div className="rb-canvas-actions">
                                <button
                                    className="btn btn-action"
                                    onClick={generateFromProfile}
                                    disabled={canvasGenerating}
                                >
                                    <FiZap /> {canvasGenerating ? 'Generating…' : (current ? 'Regenerate from profile' : 'Generate from my profile')}
                                </button>
                                {!current && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
                                        <FiSliders /> Or start a blank draft
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 16 }}>
                            <h3 className="card-title" style={{ marginBottom: 8 }}><FiEdit /> Refine with an instruction</h3>
                            <p className="rb-canvas-help">Tell the AI what to change — e.g. "make the summary one sentence", "tighten the bullets in the second job", "reorder skills to put Python first". Existing employers, degrees and dates are preserved.</p>
                            <div className="rb-cmd-row">
                                <input
                                    className="form-input rb-cmd-input"
                                    type="text"
                                    maxLength={500}
                                    placeholder={current ? 'What should I change?' : 'Generate a draft first to enable refinement.'}
                                    value={canvasInstruction}
                                    onChange={e => setCanvasInstruction(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !refineDisabled) refineWithInstruction(); }}
                                    disabled={!current || canvasRefining}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={refineWithInstruction}
                                    disabled={refineDisabled || !current}
                                >
                                    <FiSend /> {canvasRefining ? 'Refining…' : 'Refine'}
                                </button>
                            </div>
                            {canvasChanged.length > 0 && (
                                <div className="rb-canvas-changed">
                                    <span>Just updated:</span>
                                    {canvasChanged.map(s => <span key={s} className="chip">{s}</span>)}
                                </div>
                            )}
                            {canvasError && <p className="rb-canvas-error" role="alert">{canvasError}</p>}
                        </div>

                        <div className="glass-card">
                            <h3 className="card-title" style={{ marginBottom: 8 }}><FiDownload /> Export</h3>
                            <p className="rb-canvas-help">Server-rendered .pdf / .docx — the live preview on the right is the source of truth.</p>
                            <div className="rb-canvas-actions" style={{ marginTop: 12 }}>
                                <button
                                    className="btn btn-action"
                                    onClick={() => exportViaServer('pdf')}
                                    disabled={canvasExporting !== null}
                                >
                                    <FiDownload /> {canvasExporting === 'pdf' ? 'Exporting PDF…' : 'Export PDF'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => exportViaServer('docx')}
                                    disabled={canvasExporting !== null}
                                >
                                    <FiFile /> {canvasExporting === 'docx' ? 'Exporting DOCX…' : 'Export DOCX'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <aside className="rb-preview">
                        <div className="rb-preview-bar">
                            <span className="rb-preview-label">Live preview</span>
                        </div>
                        <div className="rb-paper">
                            <ResumePreview form={form} highlighted={canvasChanged} />
                        </div>
                    </aside>
                </div>
            </div>
        );
    }

    const steps = ['Template', 'Personal', 'Education', 'Experience', 'Skills & Projects', 'Cover Letter', 'Preview'];

    return (
        <div className="page">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setStep(0)}><FiArrowLeft /> Back</button>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{form.name || 'New Resume'}</h2>
                {current && (
                    <button
                        className="btn btn-secondary btn-sm"
                        title="Switch to the canvas / AI flow"
                        onClick={() => setStep('canvas')}
                    ><FiZap /> Canvas view</button>
                )}
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={saveDraft} disabled={loading}><FiSave /> {loading ? 'Saving...' : 'Save'}</button>
            </div>

            <div className="tabs" style={{ marginBottom: 24 }}>
                {steps.map((s, i) => (<button key={s} className={`tab ${step - 1 === i ? 'active' : ''}`} onClick={() => setStep(i + 1)}>{s}</button>))}
            </div>

            <div className="rb-layout">
              <div className="rb-editor">
            {/* Step 1: Template */}
            {step === 1 && (
                <div className="grid grid-3">
                    {TEMPLATES.map(t => (
                        <div key={t.id} className={`template-card ${form.template === t.id ? 'selected' : ''}`} onClick={() => setForm(prev => ({ ...prev, template: t.id }))}>
                            <div className="template-preview" style={{ borderTop: `4px solid ${t.color}`, display: 'flex', flexDirection: 'column', gap: 4, padding: 20 }}>
                                <div style={{ height: 10, width: '60%', background: t.color, borderRadius: 2 }} />
                                <div style={{ height: 6, width: '80%', background: '#ddd', borderRadius: 2, marginTop: 8 }} />
                                <div style={{ height: 6, width: '70%', background: '#eee', borderRadius: 2 }} />
                                <div style={{ height: 6, width: '90%', background: '#eee', borderRadius: 2 }} />
                                <div style={{ height: 8, width: '40%', background: t.color, borderRadius: 2, marginTop: 12, opacity: 0.5 }} />
                                <div style={{ height: 6, width: '85%', background: '#ddd', borderRadius: 2, marginTop: 6 }} />
                                <div style={{ height: 6, width: '75%', background: '#eee', borderRadius: 2 }} />
                            </div>
                            <div style={{ padding: 16, background: 'var(--bg-card)' }}>
                                <h4 style={{ fontSize: 15 }}>{t.name}</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Step 2: Personal Info */}
            {step === 2 && (
                <div className="glass-card" style={{ maxWidth: 700 }}>
                    <div className="grid grid-2">
                        <div className="form-group"><label>Full Name</label><input className="form-input" value={form.personalInfo.fullName} onChange={e => updatePersonal('fullName', e.target.value)} /></div>
                        <div className="form-group"><label>Email</label><input className="form-input" value={form.personalInfo.email} onChange={e => updatePersonal('email', e.target.value)} /></div>
                        <div className="form-group"><label>Phone</label><input className="form-input" value={form.personalInfo.phone} onChange={e => updatePersonal('phone', e.target.value)} /></div>
                        <div className="form-group"><label>Location</label><input className="form-input" value={form.personalInfo.location} onChange={e => updatePersonal('location', e.target.value)} /></div>
                        <div className="form-group"><label>LinkedIn</label><input className="form-input" value={form.personalInfo.linkedin} onChange={e => updatePersonal('linkedin', e.target.value)} /></div>
                        <div className="form-group"><label>GitHub</label><input className="form-input" value={form.personalInfo.github} onChange={e => updatePersonal('github', e.target.value)} /></div>
                    </div>
                    <div className="form-group">
                        <label>Professional Summary</label>
                        <textarea className="form-textarea" rows={4} value={form.personalInfo.summary} onChange={e => updatePersonal('summary', e.target.value)} />
                    </div>
                    <div className="form-group"><label>Job Description (for AI optimization)</label>
                        <textarea className="form-textarea" rows={3} value={form.jobDescription} onChange={e => setForm(prev => ({ ...prev, jobDescription: e.target.value }))} placeholder="Paste the target job description..." />
                    </div>
                    <button className="btn btn-primary" onClick={aiGenerate} disabled={generating}><FiZap /> {generating ? 'Generating...' : 'AI Optimize'}</button>
                    {aiSuccess && <p style={{ marginTop: 12, fontSize: 13, color: aiSuccess.startsWith('✅') ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 600 }}>{aiSuccess}</p>}
                </div>
            )}

            {/* Step 3: Education */}
            {step === 3 && (
                <div style={{ maxWidth: 700 }}>
                    {form.education.map((edu, i) => (
                        <div key={i} className="glass-card" style={{ marginBottom: 16 }}>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Institution</label><input className="form-input" value={edu.institution || ''} onChange={e => updateArr('education', i, 'institution', e.target.value)} /></div>
                                <div className="form-group"><label>Degree</label><input className="form-input" value={edu.degree || ''} onChange={e => updateArr('education', i, 'degree', e.target.value)} /></div>
                                <div className="form-group"><label>Field</label><input className="form-input" value={edu.field || ''} onChange={e => updateArr('education', i, 'field', e.target.value)} /></div>
                                <div className="form-group"><label>GPA</label><input className="form-input" value={edu.gpa || ''} onChange={e => updateArr('education', i, 'gpa', e.target.value)} /></div>
                                <div className="form-group"><label>Start</label><input className="form-input" type="month" value={edu.startDate || ''} onChange={e => updateArr('education', i, 'startDate', e.target.value)} /></div>
                                <div className="form-group"><label>End</label><input className="form-input" type="month" value={edu.endDate || ''} onChange={e => updateArr('education', i, 'endDate', e.target.value)} /></div>
                            </div>
                        </div>
                    ))}
                    <button className="btn btn-secondary" onClick={() => addArr('education', {})}><FiPlus /> Add Education</button>
                </div>
            )}

            {/* Step 4: Experience */}
            {step === 4 && (
                <div style={{ maxWidth: 700 }}>
                    {form.experience.map((exp, i) => (
                        <div key={i} className="glass-card" style={{ marginBottom: 16 }}>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Company</label><input className="form-input" value={exp.company || ''} onChange={e => updateArr('experience', i, 'company', e.target.value)} /></div>
                                <div className="form-group"><label>Position</label><input className="form-input" value={exp.position || ''} onChange={e => updateArr('experience', i, 'position', e.target.value)} /></div>
                                <div className="form-group"><label>Start</label><input className="form-input" type="month" value={exp.startDate || ''} onChange={e => updateArr('experience', i, 'startDate', e.target.value)} /></div>
                                <div className="form-group"><label>End</label><input className="form-input" type="month" value={exp.endDate || ''} onChange={e => updateArr('experience', i, 'endDate', e.target.value)} /></div>
                            </div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" rows={3} value={exp.description || ''} onChange={e => updateArr('experience', i, 'description', e.target.value)} /></div>
                        </div>
                    ))}
                    <button className="btn btn-secondary" onClick={() => addArr('experience', {})}><FiPlus /> Add Experience</button>
                </div>
            )}

            {/* Step 5: Skills & Projects */}
            {step === 5 && (
                <div style={{ maxWidth: 700 }}>
                    <div className="glass-card" style={{ marginBottom: 20 }}>
                        <h3 style={{ marginBottom: 16 }}>Skills</h3>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <input className="form-input" placeholder="Add a skill" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} style={{ flex: 1 }} />
                            <button className="btn btn-primary btn-sm" onClick={addSkill}><FiPlus /></button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {form.skills.map((s, i) => (<span key={i} className="chip" style={{ cursor: 'pointer' }} onClick={() => removeSkill(i)}>{s} ×</span>))}
                        </div>
                    </div>
                    <h3 style={{ marginBottom: 16 }}>Projects</h3>
                    {form.projects.map((p, i) => (
                        <div key={i} className="glass-card" style={{ marginBottom: 16 }}>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Name</label><input className="form-input" value={p.name || ''} onChange={e => updateArr('projects', i, 'name', e.target.value)} /></div>
                                <div className="form-group"><label>Technologies</label><input className="form-input" value={p.technologies || ''} onChange={e => updateArr('projects', i, 'technologies', e.target.value)} /></div>
                            </div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" rows={2} value={p.description || ''} onChange={e => updateArr('projects', i, 'description', e.target.value)} /></div>
                        </div>
                    ))}
                    <button className="btn btn-secondary" onClick={() => addArr('projects', {})}><FiPlus /> Add Project</button>
                </div>
            )}

            {/* Step 6: Cover Letter */}
            {step === 6 && (
                <div style={{ maxWidth: 700 }}>
                    <div className="glass-card">
                        <div className="grid grid-2" style={{ marginBottom: 16 }}>
                            <div className="form-group"><label>Job Title</label><input className="form-input" value={form.coverLetter.jobTitle || ''} onChange={e => setForm(prev => ({ ...prev, coverLetter: { ...prev.coverLetter, jobTitle: e.target.value } }))} /></div>
                            <div className="form-group"><label>Company Name</label><input className="form-input" value={form.coverLetter.companyName || ''} onChange={e => setForm(prev => ({ ...prev, coverLetter: { ...prev.coverLetter, companyName: e.target.value } }))} /></div>
                        </div>
                        <button className="btn btn-primary" onClick={aiCoverLetter} disabled={coverLetterGen} style={{ marginBottom: 16 }}><FiZap /> {coverLetterGen ? 'Generating...' : 'AI Generate Cover Letter'}</button>
                        <div className="form-group"><label>Cover Letter Content</label><textarea className="form-textarea" rows={12} value={form.coverLetter.content || ''} onChange={e => setForm(prev => ({ ...prev, coverLetter: { ...prev.coverLetter, content: e.target.value } }))} /></div>
                    </div>
                </div>
            )}

            {/* Step 7: Finish & Export */}
            {step === 7 && (
                <div className="glass-card">
                    <h3 className="card-title" style={{ marginBottom: 8 }}><FiDownload /> Finish &amp; Export</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>The live preview on the right is exactly what gets exported — pick a template on step 1 to change its look.</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button className="btn btn-action" onClick={downloadPDF}><FiDownload /> Download PDF</button>
                        <button className="btn btn-secondary" onClick={downloadDOCX}><FiFile /> Download DOCX</button>
                        <button className="btn btn-secondary" onClick={saveDraft} disabled={loading}><FiSave /> {loading ? 'Saving…' : 'Save draft'}</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>← Previous</button>}
                {step < 7 && <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { if (step === 6) saveDraft(); setStep(s => s + 1); }}>Next →</button>}
            </div>
              </div>{/* /rb-editor */}

              <aside className="rb-preview">
                <div className="rb-preview-bar">
                    <span className="rb-preview-label">Live preview</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={downloadPDF}><FiDownload /> PDF</button>
                        <button className="btn btn-secondary btn-sm" onClick={downloadDOCX}><FiFile /> DOCX</button>
                    </div>
                </div>
                <div className="rb-paper"><ResumePreview form={form} /></div>
              </aside>
            </div>{/* /rb-layout */}
        </div>
    );
};

export default ResumeBuilder;
