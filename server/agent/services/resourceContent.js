/**
 * Resource text extraction (Phase 2) — turns a learning-path step's resource into
 * plain text the final-test generator can build questions from.
 *
 *  - article / link  → fetch (SSRF-guarded) → Readability textContent; HTML-strip
 *                      fallback when Readability can't parse the page.
 *  - pdf             → pdf-parse over the stored bytes (storage.readFile) or the
 *                      public fileUrl.
 *  - video/doc/ppt/image/file → title + description + topic (nothing to extract).
 *
 * Extracted text is cached on the Resource doc (`extractedText`, `extractedAt`)
 * so a re-generation doesn't re-fetch. Capped to keep prompt size bounded.
 */
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const pdfParse = require('pdf-parse');
const storage = require('../../utils/storage');
const { assertSafeUrl } = require('../../utils/urlGuard');

const MAX_CHARS = 12000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const clamp = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);

const stripHtml = (html) => String(html || '')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Always-available fallback: the resource's own metadata + topic name.
function metaText(resource) {
  const topicName = resource.topic?.name || (typeof resource.topic === 'string' ? resource.topic : '');
  return clamp([resource.title, resource.description, topicName].filter(Boolean).join('. '));
}

// Fetch an article/link and extract readable text (SSRF-guarded, redirect-safe).
async function fromUrl(url) {
  let currentUrl = String(url || '');
  if (!currentUrl) return '';
  let resp;
  for (let hop = 0; hop < 4; hop++) {
    const check = await assertSafeUrl(currentUrl);
    if (!check.ok) return '';
    resp = await axios.get(currentUrl, {
      timeout: 8000, maxRedirects: 0,
      validateStatus: (s) => (s >= 200 && s < 400),
      maxContentLength: 5 * 1024 * 1024, responseType: 'text',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM-PathTest/1.0)' },
    });
    if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
      currentUrl = new URL(resp.headers.location, currentUrl).toString();
      continue;
    }
    break;
  }
  if (!resp || resp.status >= 300) return '';
  try {
    const dom = new JSDOM(resp.data, { url: currentUrl });
    const article = new Readability(dom.window.document).parse();
    if (article && article.textContent && article.textContent.trim().length > 200) {
      return clamp(article.textContent);
    }
  } catch { /* fall through to strip */ }
  return clamp(stripHtml(resp.data));
}

// Extract a PDF resource's text from stored bytes or its public URL.
async function fromPdf(resource) {
  let buffer = null;
  if (resource.fileKey && typeof storage.readFile === 'function') {
    buffer = await storage.readFile(resource.fileKey).catch(() => null);
  }
  if (!buffer && resource.fileUrl) {
    const check = await assertSafeUrl(resource.fileUrl).catch(() => ({ ok: false }));
    if (check.ok) {
      const r = await axios.get(resource.fileUrl, { timeout: 10000, responseType: 'arraybuffer', maxContentLength: 12 * 1024 * 1024 }).catch(() => null);
      if (r && r.data) buffer = Buffer.from(r.data);
    }
  }
  if (!buffer) return '';
  try { const parsed = await pdfParse(buffer); return clamp(parsed.text); } catch { return ''; }
}

/**
 * Extract text for a single resource (Mongoose doc, ideally topic-populated).
 * Caches the result on the doc. Always returns a non-empty string (falls back to
 * metadata) so the test generator always has *something* per step.
 * @returns {Promise<string>}
 */
async function extractText(resource) {
  if (!resource) return '';
  // Cache hit (fresh) → reuse.
  if (resource.extractedText && resource.extractedAt && (Date.now() - new Date(resource.extractedAt).getTime()) < CACHE_TTL_MS) {
    return resource.extractedText;
  }

  const type = resource.resourceType;
  let text = '';
  try {
    if (type === 'article' || type === 'link') {
      text = await fromUrl(resource.link);
    } else if (type === 'pdf') {
      text = await fromPdf(resource);
    }
    // video/doc/ppt/image/file (and any extraction miss) → metadata fallback.
  } catch { /* best-effort; fall back below */ }

  if (!text || text.length < 80) text = metaText(resource);

  // Cache on the doc (best-effort; never fail extraction over a cache write).
  try {
    resource.extractedText = text;
    resource.extractedAt = new Date();
    await resource.save();
  } catch { /* ignore */ }

  return text;
}

module.exports = { extractText, metaText, MAX_CHARS };
