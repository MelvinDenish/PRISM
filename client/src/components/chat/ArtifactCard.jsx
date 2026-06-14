import { useState } from 'react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import { downloadArtifact } from '../../services/api';

/**
 * Renders a persisted artifact result object:
 *   { kind: 'artifact', id, title, format, url }
 *
 * Only renders for kind === 'artifact' entries — other confirm result kinds
 * (learning_path, mentorship_session, resume_rewrite) are handled by ProposalCard.
 *
 * Download is done via fetch+Authorization blob (no token in URL).
 */
const FORMAT_ICONS = {
  pdf:  <FiFileText aria-hidden="true" />,
  docx: <FiFile aria-hidden="true" />,
  md:   <FiFileText aria-hidden="true" />,
};

const FORMAT_LABELS = {
  pdf:  'PDF',
  docx: 'Word (.docx)',
  md:   'Markdown',
};

const ArtifactCard = ({ artifact }) => {
  const [status, setStatus] = useState('idle'); // idle | downloading | error
  const [errorMsg, setErrorMsg] = useState('');

  if (!artifact || artifact.kind !== 'artifact' || !artifact.id) return null;

  const { id, title, format } = artifact;
  const icon = FORMAT_ICONS[format] || <FiFile aria-hidden="true" />;
  const formatLabel = FORMAT_LABELS[format] || format?.toUpperCase() || 'File';
  const filename = `${title || 'document'}.${format || 'bin'}`;

  const handleDownload = async () => {
    if (status === 'downloading') return;
    setStatus('downloading');
    setErrorMsg('');
    try {
      await downloadArtifact(id, filename);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Download failed.');
    }
  };

  return (
    <div className="artifact-card">
      <div className="artifact-card__icon">{icon}</div>
      <div className="artifact-card__body">
        <div className="artifact-card__title">{title || 'Generated document'}</div>
        <div className="artifact-card__meta">{formatLabel}</div>
        {status === 'error' && (
          <div className="artifact-card__error">{errorMsg}</div>
        )}
      </div>
      <button
        className="artifact-card__download"
        onClick={handleDownload}
        disabled={status === 'downloading'}
        aria-label={`Download ${filename}`}
      >
        <FiDownload aria-hidden="true" />
        {status === 'downloading' ? 'Downloading…' : 'Download'}
      </button>
    </div>
  );
};

export default ArtifactCard;
