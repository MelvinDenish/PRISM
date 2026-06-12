/**
 * Document generation service for the PRISM Copilot.
 *
 * generateDocument({ userId, conversationId?, kind?, title, format, content })
 *   Renders a file server-side (docx/pdf/md), saves it via the storage driver,
 *   persists an Artifact record, and returns { id, title, format, url } where
 *   url is the authenticated download route /api/artifacts/:id/download.
 *
 * content contract (either shape accepted):
 *   - { sections: [{ heading?: string, paragraphs: [string] }] }
 *   - plain markdown string (split into sections on blank-line boundaries)
 *
 * Renderers: docx (via `docx` npm pkg), pdf (via `pdfkit`), md (plain buffer).
 * No headless Chrome, no external services.
 */

const Artifact = require('../../models/Artifact');
const storage = require('../../utils/storage');

// ---------------------------------------------------------------------------
// Normalise content into the structured shape
// ---------------------------------------------------------------------------
function normalise(raw) {
  if (typeof raw === 'string') {
    // Split on blank lines — each chunk becomes one section.
    const chunks = raw.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
    return {
      sections: chunks.map((chunk) => {
        const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
        // If the first line looks like a markdown heading, use it.
        if (/^#{1,4}\s/.test(lines[0])) {
          return {
            heading: lines[0].replace(/^#{1,4}\s+/, ''),
            paragraphs: lines.slice(1).filter(Boolean),
          };
        }
        return { paragraphs: lines };
      }),
    };
  }
  if (raw && Array.isArray(raw.sections)) return raw;
  throw new Error('content must be a string or { sections: [...] } object');
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

async function renderMd(structured) {
  const parts = [];
  for (const sec of structured.sections) {
    if (sec.heading) parts.push(`## ${sec.heading}`);
    for (const p of (sec.paragraphs || [])) parts.push(p);
    parts.push('');
  }
  return Buffer.from(parts.join('\n'), 'utf8');
}

async function renderDocx(structured) {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
  } = require('docx');

  const children = [];
  for (const sec of structured.sections) {
    if (sec.heading) {
      children.push(new Paragraph({
        text: sec.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 120 },
      }));
    }
    for (const p of (sec.paragraphs || [])) {
      children.push(new Paragraph({
        children: [new TextRun({ text: p })],
        spacing: { after: 160 },
      }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 24 }, // 12pt
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

async function renderPdf(structured) {
  const PDFDocument = require('pdfkit');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica').fontSize(12);

    for (const sec of structured.sections) {
      if (sec.heading) {
        doc.moveDown(0.5)
           .font('Helvetica-Bold')
           .fontSize(14)
           .text(sec.heading)
           .moveDown(0.3)
           .font('Helvetica')
           .fontSize(12);
      }
      for (const p of (sec.paragraphs || [])) {
        doc.text(p, { lineGap: 4 }).moveDown(0.4);
      }
    }

    doc.end();
  });
}

const RENDERERS = { md: renderMd, docx: renderDocx, pdf: renderPdf };
const MIME_TYPES = {
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a document, save it, persist an Artifact, and return the result.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {string} [p.conversationId]
 * @param {string} [p.kind]      'resume'|'cover_letter'|'document'
 * @param {string} p.title
 * @param {string} p.format      'docx'|'pdf'|'md'
 * @param {string|object} p.content
 * @returns {Promise<{ id: string, title: string, format: string, url: string }>}
 */
async function generateDocument({ userId, conversationId, kind = 'document', title, format, content }) {
  if (!RENDERERS[format]) throw new Error(`Unsupported format: "${format}". Use docx, pdf, or md.`);

  const structured = normalise(content);
  const render = RENDERERS[format];
  const buffer = await render(structured);

  const ext = format === 'docx' ? '.docx' : format === 'pdf' ? '.pdf' : '.md';
  const { key } = await storage.saveFile({
    buffer,
    mimeType: MIME_TYPES[format],
    originalName: `${title}${ext}`,
    folder: 'artifacts',
  });

  const artifact = await Artifact.create({
    user: userId,
    ...(conversationId ? { conversation: conversationId } : {}),
    kind,
    title,
    format,
    artifactKey: key,
    artifactDriver: storage.driver,
    sizeBytes: buffer.byteLength,
  });

  const id = String(artifact._id);
  return {
    id,
    title,
    format,
    url: `/api/artifacts/${id}/download`,
  };
}

module.exports = { generateDocument };
