// Phase 2 resource-extraction behavioral verify (the P2 check "real text extracted
// for article/PDF, fallback for video"). No HTTP — calls the service directly.
//   node seeds/verifyResourceExtract.js     (needs internet for the article fetch)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const Topic = require('../models/Topic');
const User = require('../models/User');
const storage = require('../utils/storage');
const { extractText } = require('../agent/services/resourceContent');

// A real, text-rich PDF — a CUIC practice sheet (pdfkit output trips pdf-parse's
// XRef parser, and a tiny dummy PDF is below the extractor's 80-char floor).
const PDF_PATH = path.join(__dirname, '..', '..', 'from_cuic', 'Codes', 'C.O.D.E - 1 - Array.pdf');

let okN = 0;
const assert = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); okN++; console.log(`ok — ${m}`); };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const owner = await User.findOne({ role: 'admin' }) || await User.findOne({});
  const topic = await Topic.findOne({ name: 'Arrays' }) || await Topic.findOne({});
  const created = [];
  let pdfKey = null;

  try {
    // 1) PDF — store a real PDF, then extract it back via storage.readFile + pdf-parse.
    const buffer = fs.readFileSync(PDF_PATH);
    const saved = await storage.saveFile({ buffer, mimeType: 'application/pdf', originalName: 'extract-test.pdf', folder: 'resources' });
    pdfKey = saved.key;
    const pdfRes = await Resource.create({ title: 'Extract PDF', description: 'pdf', topic: topic._id, resourceType: 'pdf', fileKey: saved.key, fileUrl: saved.url, uploadedBy: owner._id });
    created.push(pdfRes._id);

    // 2) Article — fetch a stable public page and Readability-extract it.
    const artRes = await Resource.create({ title: 'Binary Search (article)', description: 'article', topic: topic._id, resourceType: 'article', link: 'https://en.wikipedia.org/wiki/Binary_search_algorithm', uploadedBy: owner._id });
    created.push(artRes._id);

    // 3) Video — nothing to fetch; must fall back to title+description+topic.
    const vidRes = await Resource.create({ title: 'Sorting Crash Course', description: 'A video on sorting algorithms.', topic: topic._id, resourceType: 'video', link: 'https://youtu.be/whatever', uploadedBy: owner._id });
    created.push(vidRes._id);

    const load = (id) => Resource.findById(id).populate('topic', 'name');

    const pdfText = await extractText(await load(pdfRes._id));
    assert(pdfText.length > 200 && /array|hackerrank/i.test(pdfText) && !/^Extract PDF/.test(pdfText), `PDF → real text extracted via storage.readFile + pdf-parse (${pdfText.length} chars)`);

    const artText = await extractText(await load(artRes._id));
    assert(artText.length > 400 && /search/i.test(artText), `article → real readable text extracted (${artText.length} chars)`);
    assert(!/youtu|<html|<script/i.test(artText), 'article text is clean (no raw HTML)');

    const vidText = await extractText(await load(vidRes._id));
    assert(/Sorting Crash Course/.test(vidText) && /video on sorting/i.test(vidText), 'video → metadata fallback (title + description)');
    assert(!/<.*>/.test(vidText), 'video fallback contains no markup');

    // 4) Caching — the doc now carries extractedText/extractedAt; a re-extract reuses it.
    const cachedDoc = await load(pdfRes._id);
    assert(cachedDoc.extractedText && cachedDoc.extractedAt, 'extraction is cached on the resource doc');
    const before = cachedDoc.extractedAt.getTime();
    const again = await extractText(cachedDoc);
    assert(again === cachedDoc.extractedText && cachedDoc.extractedAt.getTime() === before, 'cached extraction reused (no re-fetch)');

    console.log(`\nRESOURCE EXTRACTION VERIFY: ALL ${okN} CHECKS PASSED`);
  } finally {
    await Resource.deleteMany({ _id: { $in: created } });
    if (pdfKey) { try { await storage.deleteFile(pdfKey); } catch { /* best-effort */ } }
    await mongoose.disconnect();
  }
})().catch((e) => { console.error('VERIFY ERROR:', e.message); process.exit(1); });
