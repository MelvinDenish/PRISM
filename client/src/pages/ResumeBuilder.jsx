import { useState, useEffect } from 'react';
import { getResumeDrafts, saveResumeDraft, updateResumeDraft, deleteResumeDraft, generateResumeContent, generateCoverLetter } from '../services/api';
import { FiPlus, FiTrash2, FiDownload, FiZap, FiFileText, FiEdit, FiSave, FiArrowLeft, FiFile } from 'react-icons/fi';
import { saveAs } from 'file-saver';

const TEMPLATES = [
    { id: 'modern', name: 'Modern', desc: 'Clean layout with accent colors', color: '#10b981' },
    { id: 'classic', name: 'Classic', desc: 'Traditional format for corporates', color: '#6366f1' },
    { id: 'creative', name: 'Creative', desc: 'Bold design for startups', color: '#f59e0b' },
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

    useEffect(() => { loadDrafts(); }, []);

    const loadDrafts = async () => {
        try { const { data } = await getResumeDrafts(); setDrafts(data.drafts || []); } catch {}
    };

    const newDraft = () => {
        setCurrent(null);
        setForm({ name: 'My Resume', template: 'modern', personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', summary: '' }, education: [{ institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '' }], experience: [{ company: '', position: '', startDate: '', endDate: '', current: false, description: '' }], skills: [], projects: [{ name: '', description: '', technologies: '', link: '' }], coverLetter: { template: 'professional', content: '', jobTitle: '', companyName: '' }, jobDescription: '' });
        setStep(1);
    };

    const editDraft = (draft) => {
        setCurrent(draft._id);
        setForm({ name: draft.name, template: draft.template, personalInfo: draft.personalInfo || {}, education: draft.education?.length ? draft.education : [{}], experience: draft.experience?.length ? draft.experience : [{}], skills: draft.skills || [], projects: draft.projects?.length ? draft.projects : [{}], coverLetter: draft.coverLetter || {}, jobDescription: draft.jobDescription || '' });
        setStep(1);
    };

    const saveDraft = async () => {
        setLoading(true);
        try {
            if (current) { await updateResumeDraft(current, form); }
            else { const { data } = await saveResumeDraft(form); setCurrent(data.draft._id); }
            loadDrafts();
        } catch (err) { console.error(err); }
        setLoading(false);
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

    const tc = TEMPLATES.find(t => t.id === form.template)?.color || '#10b981';

    // LIST VIEW
    if (step === 0) {
        return (
            <div className="page">
                <div className="page-header">
                    <h1 className="page-title">📄 <span>Resume Builder</span></h1>
                    <button className="btn btn-primary" onClick={newDraft}><FiPlus /> New Resume</button>
                </div>
                {drafts.length === 0 ? (
                    <div className="empty-state"><div className="icon">📄</div><p>No resumes yet. Create your first one!</p></div>
                ) : (
                    <div className="grid grid-3">
                        {drafts.map(d => (
                            <div key={d._id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => editDraft(d)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div><h3 style={{ fontSize: 16 }}>{d.name}</h3><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.template} template</p></div>
                                    <button className="btn btn-sm" style={{ background: 'none', color: 'var(--accent-danger)' }} onClick={e => { e.stopPropagation(); removeDraft(d._id); }}><FiTrash2 /></button>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{d.personalInfo?.fullName || 'No name'}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>Updated: {new Date(d.updatedAt).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const steps = ['Template', 'Personal', 'Education', 'Experience', 'Skills & Projects', 'Cover Letter', 'Preview'];

    return (
        <div className="page">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setStep(0)}><FiArrowLeft /> Back</button>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{form.name || 'New Resume'}</h2>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={saveDraft} disabled={loading}><FiSave /> {loading ? 'Saving...' : 'Save'}</button>
            </div>

            <div className="tabs" style={{ marginBottom: 24 }}>
                {steps.map((s, i) => (<button key={s} className={`tab ${step - 1 === i ? 'active' : ''}`} onClick={() => setStep(i + 1)}>{s}</button>))}
            </div>

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

            {/* Step 7: Preview & Download */}
            {step === 7 && (
                <div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        <button className="btn btn-primary" onClick={downloadPDF}><FiDownload /> PDF</button>
                        <button className="btn btn-secondary" onClick={downloadDOCX}><FiFile /> DOCX</button>
                    </div>
                    <div id="resume-preview" style={{ background: 'white', color: '#333', padding: 48, borderRadius: 12, maxWidth: 800, fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
                        <div style={{ borderBottom: `3px solid ${tc}`, paddingBottom: 16, marginBottom: 20 }}>
                            <h1 style={{ fontSize: 28, color: '#1a1a2e', margin: 0 }}>{form.personalInfo.fullName || 'Your Name'}</h1>
                            <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{[form.personalInfo.email, form.personalInfo.phone, form.personalInfo.location].filter(Boolean).join(' | ')}</p>
                            {(form.personalInfo.linkedin || form.personalInfo.github) && <p style={{ color: tc, fontSize: 12, marginTop: 2 }}>{[form.personalInfo.linkedin, form.personalInfo.github].filter(Boolean).join(' | ')}</p>}
                        </div>
                        {form.personalInfo.summary && <div style={{ marginBottom: 20 }}><h3 style={{ color: tc, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>Summary</h3><p style={{ fontSize: 13 }}>{form.personalInfo.summary}</p></div>}
                        {form.skills.length > 0 && <div style={{ marginBottom: 20 }}><h3 style={{ color: tc, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>Skills</h3><p style={{ fontSize: 13 }}>{form.skills.join(' • ')}</p></div>}
                        {form.experience.some(e => e.company) && <div style={{ marginBottom: 20 }}><h3 style={{ color: tc, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>Experience</h3>{form.experience.filter(e => e.company).map((e, i) => (<div key={i} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: 14 }}>{e.position}</strong><span style={{ color: '#888', fontSize: 12 }}>{e.startDate} - {e.current ? 'Present' : e.endDate}</span></div><p style={{ color: '#555', fontSize: 13 }}>{e.company}</p>{e.description && <p style={{ fontSize: 12, marginTop: 4, color: '#666' }}>{e.description}</p>}</div>))}</div>}
                        {form.education.some(e => e.institution) && <div style={{ marginBottom: 20 }}><h3 style={{ color: tc, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>Education</h3>{form.education.filter(e => e.institution).map((e, i) => (<div key={i} style={{ marginBottom: 8 }}><strong style={{ fontSize: 14 }}>{e.degree} in {e.field}</strong><p style={{ color: '#666', fontSize: 12 }}>{e.institution} | {e.startDate} - {e.endDate} {e.gpa ? `| GPA: ${e.gpa}` : ''}</p></div>))}</div>}
                        {form.projects.some(p => p.name) && <div><h3 style={{ color: tc, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>Projects</h3>{form.projects.filter(p => p.name).map((p, i) => (<div key={i} style={{ marginBottom: 8 }}><strong style={{ fontSize: 14 }}>{p.name}</strong><p style={{ fontSize: 12, color: '#666' }}>{p.description}</p>{p.technologies && <p style={{ fontSize: 11, color: tc }}>Tech: {p.technologies}</p>}</div>))}</div>}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>← Previous</button>}
                {step < 7 && <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { if (step === 6) saveDraft(); setStep(s => s + 1); }}>Next →</button>}
            </div>
        </div>
    );
};

export default ResumeBuilder;
