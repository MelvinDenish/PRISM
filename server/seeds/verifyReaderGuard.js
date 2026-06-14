// Verify the in-app reader's article-quality guard (routes/resources.js).
// Runs the REAL pipeline — fetch → JSDOM → Readability → isReadableArticle —
// against live pages and asserts a homepage (the cp-algorithms.com/ changelog
// users were seeing) is rejected while a genuine article is accepted.
//
//   node seeds/verifyReaderGuard.js   (needs network; no DB)
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { _isReadableArticle } = require('../routes/resources');

async function extract(url) {
    const resp = await axios.get(url, {
        timeout: 15000,
        responseType: 'text',
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM-Reader/1.0)' },
    });
    const dom = new JSDOM(resp.data, { url });
    return new Readability(dom.window.document).parse();
}

const CASES = [
    { url: 'https://cp-algorithms.com/', expect: false, label: 'cp-algorithms HOMEPAGE (the reported bug — news/changelog)' },
    { url: 'https://cp-algorithms.com/graph/strongly-connected-components.html', expect: true, label: 'cp-algorithms SCC ARTICLE (must still read in-app)' },
];

(async () => {
    let pass = 0;
    for (const c of CASES) {
        let article = null;
        try { article = await extract(c.url); } catch (e) { console.log(`  ~ fetch failed for ${c.url}: ${e.message}`); }
        const got = article && article.content ? _isReadableArticle(c.url, article) : false;
        const ok = got === c.expect;
        const len = article?.textContent?.trim().length ?? 0;
        console.log(`${ok ? 'ok  ' : 'FAIL'} — ${c.label}\n       isReadableArticle=${got} (expected ${c.expect}); extracted textLen=${len}`);
        if (ok) pass++; else process.exitCode = 1;
    }
    console.log(`\nREADER GUARD: ${pass}/${CASES.length} passed`);
})().catch((e) => { console.error(e.message); process.exit(1); });
