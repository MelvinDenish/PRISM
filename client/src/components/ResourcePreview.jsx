import { useEffect, useState } from 'react';
import { FiX, FiExternalLink, FiDownload, FiZap, FiLoader } from 'react-icons/fi';
import DOMPurify from 'dompurify';
import Modal from './ui/Modal';
import { getResourceReader } from '../services/api';

const ytId = (url = '') => {
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&]+)/);
    return m ? m[1] : null;
};
const vimeoId = (url = '') => {
    const m = String(url).match(/vimeo\.com\/(\d+)/);
    return m ? m[1] : null;
};

const OFFICE_EXT = /\.(pptx?|docx?|xlsx?)$/i;
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const PDF_EXT = /\.pdf$/i;

/**
 * ResourcePreview — opens any resource IN-APP (no redirect):
 *  - YouTube/Vimeo → embedded player
 *  - PDF / image (uploaded or linked) → inline viewer
 *  - PPT/DOC/XLS → Microsoft Office online viewer (needs a public URL — S3)
 *  - article / generic link → server "reader" extraction (sanitized), with a
 *    graceful "open original" fallback when a site can't be read.
 */
const ResourcePreview = ({ resource, onClose, onSummarize }) => {
    const [reader, setReader] = useState({ status: 'idle', data: null, error: '' });

    const src = resource?.fileUrl || resource?.link || '';
    const type = resource?.resourceType;
    const mime = resource?.mimeType || '';

    const isVideo = !!ytId(src) || !!vimeoId(src) || type === 'video';
    const isPdf = type === 'pdf' || mime === 'application/pdf' || PDF_EXT.test(src);
    const isImage = type === 'image' || mime.startsWith('image/') || IMG_EXT.test(src);
    const isOffice = type === 'ppt' || type === 'doc' || OFFICE_EXT.test(src) || mime.includes('officedocument') || mime.includes('powerpoint') || mime.includes('msword');
    const isArticle = !isVideo && !isPdf && !isImage && !isOffice;

    useEffect(() => {
        if (!isArticle || !src) return;
        let alive = true;
        setReader({ status: 'loading', data: null, error: '' });
        getResourceReader(src)
            .then(({ data }) => { if (alive) setReader({ status: 'done', data, error: '' }); })
            .catch((err) => { if (alive) setReader({ status: 'error', data: null, error: err?.response?.data?.message || 'Could not load this page for in-app reading.' }); });
        return () => { alive = false; };
    }, [src, isArticle]);

    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`;

    return (
        <Modal onClose={onClose} bare panelClassName="resource-viewer">
            <div className="resource-viewer-header">
                <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resource?.title}</h3>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {isArticle && onSummarize && (
                        <button className="btn btn-secondary btn-sm" onClick={() => onSummarize(resource)}><FiZap /> AI Summary</button>
                    )}
                    <a className="btn btn-secondary btn-sm" href={src} target="_blank" rel="noopener noreferrer"><FiExternalLink /> Original</a>
                    <button className="icon-btn" onClick={onClose} aria-label="Close"><FiX /></button>
                </div>
            </div>

            <div className="resource-viewer-content">
                {isVideo && (
                    <div className="video-embed-container">
                        <iframe
                            src={ytId(src) ? `https://www.youtube.com/embed/${ytId(src)}` : `https://player.vimeo.com/video/${vimeoId(src)}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen title={resource?.title}
                        />
                    </div>
                )}

                {isPdf && (
                    <iframe src={src} title={resource?.title} style={{ width: '100%', height: '72vh', border: 'none', borderRadius: 'var(--radius-md)' }} />
                )}

                {isImage && (
                    <div style={{ textAlign: 'center' }}><img src={src} alt={resource?.title} style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }} /></div>
                )}

                {isOffice && (
                    <div>
                        <iframe src={officeUrl} title={resource?.title} style={{ width: '100%', height: '72vh', border: 'none', borderRadius: 'var(--radius-md)' }} />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            Rendered via Microsoft Office viewer. <a className="btn btn-secondary btn-sm" href={src} download><FiDownload /> Download</a>
                        </p>
                    </div>
                )}

                {isArticle && (
                    <>
                        {reader.status === 'loading' && (
                            <div className="empty-state"><FiLoader className="spin-icon" style={{ fontSize: 28 }} /><p>Loading readable view…</p></div>
                        )}
                        {reader.status === 'done' && reader.data && (
                            <article className="reader-content">
                                {reader.data.byline && <p className="reader-byline">{reader.data.byline}</p>}
                                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reader.data.content, { USE_PROFILES: { html: true } }) }} />
                            </article>
                        )}
                        {reader.status === 'error' && (
                            <div className="empty-state">
                                <p>{reader.error}</p>
                                <a className="btn btn-action" href={src} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }}><FiExternalLink /> Open original</a>
                            </div>
                        )}
                        {resource?.description && <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>{resource.description}</p>}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ResourcePreview;
