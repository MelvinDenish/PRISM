/**
 * Company interview-question research (Interview Game, Phase 3).
 *
 * Feature-flagged on TAVILY_API_KEY: when unset, this is a clean no-op and the
 * game falls back to mentor + curated questions (mirrors the GROQ-less fallbacks).
 *
 * Pipeline: Tavily search (biased to an allow-list of interview-experience
 * sources) → fetch top pages (SSRF-guarded + Readability) → LLM structures the
 * excerpts into bank-shaped questions → AI coding cases are reference-verified →
 * upsert into QuestionBank as source:'research' with companyTag + provenanceUrl.
 *
 * Runs ON-DEMAND + CACHED and NEVER blocks game start (callers fire-and-forget).
 */
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { config } = require('../../config/env');
const llm = require('../llm');
const { assertSafeUrl } = require('../../utils/urlGuard');
const { validateCodingProblems } = require('../../utils/codingProblems');
const QuestionBank = require('../../models/QuestionBank');
const Company = require('../../models/Company');

const TAVILY_URL = 'https://api.tavily.com/search';
// Allow-list: real company-wise interview-experience sources (plan §website findings).
const ALLOW_DOMAINS = ['geeksforgeeks.org', 'placement.cseaceg.org.in', 'cseaceg.org.in', 'ambitionbox.com', 'glassdoor.com', 'glassdoor.co.in', 'leetcode.com'];

const FRESH_MS = 30 * 24 * 60 * 60 * 1000; // re-research a company at most monthly
const THIN = 8;                            // fewer than this research questions = thin

async function tavilySearch(query) {
  if (!config.hasTavily()) return [];
  try {
    const { data } = await axios.post(TAVILY_URL, {
      api_key: config.tavilyKey(), query,
      include_domains: ALLOW_DOMAINS, max_results: 5, search_depth: 'advanced',
    }, { timeout: 15000 });
    return Array.isArray(data?.results) ? data.results : [];
  } catch { return []; }
}

// Pull readable text for a result — prefer a full Readability extraction, fall
// back to Tavily's own content snippet. SSRF-guarded.
async function fetchReadable(url, fallback) {
  try {
    const check = await assertSafeUrl(url);
    if (!check.ok) return fallback || '';
    const resp = await axios.get(url, {
      timeout: 8000, maxRedirects: 2, responseType: 'text',
      maxContentLength: 4 * 1024 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM-Research/1.0)' },
    });
    const dom = new JSDOM(resp.data, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent || '';
    return (text && text.trim().length > 200) ? text.slice(0, 6000) : (fallback || '');
  } catch { return fallback || ''; }
}

// Ask the LLM to extract bank-shaped questions from interview-experience excerpts.
async function structureQuestions({ companyName, type, excerpts }) {
  if (!config.hasLLM() || !excerpts.trim()) return [];
  const shapeHint = type === 'coding'
    ? `coding problems with: id, title, description (with stdin/stdout format), 2 examples, 5 testCases, a WORKING Python 3 "referenceSolution" (it WILL be run to verify), and boilerplate {python}.`
    : type === 'hr'
      ? `HR/behavioral prompts as objects {"q":"..."}.`
      : `MCQ questions as {"q":"...","opts":["A","B","C","D"],"ans":"exact correct option"} — only include questions you can answer correctly from general CS knowledge.`;
  try {
    const message = await llm.chat({
      model: llm.GEN_MODEL(), temperature: 0.4, max_tokens: 3500,
      messages: [
        { role: 'system', content: 'You extract real interview questions from candidate experience write-ups. Return ONLY a JSON array, no prose.' },
        { role: 'user', content: `Company: ${companyName}\nRound type: ${type}\n\nFrom the interview-experience excerpts below, produce up to 6 ${type} questions actually relevant to ${companyName}. Output ${shapeHint}\n\nEXCERPTS:\n${excerpts.slice(0, 9000)}\n\nReturn a JSON array.` },
      ],
    });
    const raw = message.content || '[]';
    const arr = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// Shape + persist one type's results as source:'research', deduped by text.
async function ingest({ companyId, companyName, type, structured, provenanceUrl }) {
  let added = 0;
  if (type === 'coding') {
    const verified = await validateCodingProblems(structured); // drops unverifiable AI cases
    for (const p of verified) {
      if (!p.title) continue;
      const exists = await QuestionBank.findOne({ companyTag: companyId, type: 'coding', title: p.title });
      if (exists) continue;
      await QuestionBank.create({
        type: 'coding', title: p.title, description: p.description, examples: p.examples || [],
        testCases: p.testCases || [], boilerplate: p.boilerplate, difficulty: (p.difficulty || 'medium').toLowerCase(),
        category: 'dsa', verified: true, source: 'research', companyTag: companyId, provenanceUrl, researchedAt: new Date(),
      });
      added++;
    }
    return added;
  }
  for (const q of structured) {
    if (!q || typeof q.q !== 'string' || !q.q.trim()) continue;
    if (type !== 'hr') {
      const opts = Array.isArray(q.opts) ? q.opts.map(String) : [];
      if (opts.length < 2 || !opts.includes(String(q.ans))) continue;
    }
    const exists = await QuestionBank.findOne({ companyTag: companyId, type, q: q.q.trim() });
    if (exists) continue;
    await QuestionBank.create({
      type, q: q.q.trim(),
      ...(type !== 'hr' ? { opts: q.opts.map(String), ans: String(q.ans), explanation: q.explanation ? String(q.explanation) : undefined } : {}),
      difficulty: 'medium', verified: true, source: 'research', companyTag: companyId, provenanceUrl, researchedAt: new Date(),
    });
    added++;
  }
  return added;
}

/**
 * Research + ingest questions for a company across the given types.
 * @returns {Promise<{added:number, disabled?:boolean}>}
 */
async function researchCompanyQuestions({ companyId, companyName, types = ['technical', 'hr', 'coding'] }) {
  if (!config.hasTavily()) return { added: 0, disabled: true };
  let added = 0;
  for (const type of types) {
    const label = type === 'technical' ? 'technical interview' : type === 'coding' ? 'coding round' : type === 'aptitude' ? 'aptitude test' : 'HR interview';
    const results = await tavilySearch(`${companyName} ${label} questions placement interview experience`);
    if (!results.length) continue;
    // Concatenate the top results' readable text + remember a provenance URL.
    let excerpts = '';
    let provenanceUrl = results[0]?.url || '';
    for (const r of results.slice(0, 3)) {
      const text = await fetchReadable(r.url, r.content);
      if (text) excerpts += `\n\n[Source: ${r.url}]\n${text}`;
    }
    if (!excerpts.trim()) continue;
    const structured = await structureQuestions({ companyName, type, excerpts });
    if (structured.length) added += await ingest({ companyId, companyName, type, structured, provenanceUrl });
  }
  return { added };
}

/**
 * On-demand trigger: research a company only when its research bank is thin or
 * stale. Fire-and-forget — never throws, never blocks the caller (game start).
 */
async function maybeResearchCompany(companyId) {
  try {
    if (!companyId || !config.hasTavily()) return;
    const company = await Company.findById(companyId).select('name').lean();
    if (!company) return;
    const recent = await QuestionBank.findOne({ companyTag: companyId, source: 'research' }).sort({ researchedAt: -1 }).select('researchedAt').lean();
    const count = await QuestionBank.countDocuments({ companyTag: companyId, source: 'research' });
    const fresh = recent?.researchedAt && (Date.now() - new Date(recent.researchedAt).getTime()) < FRESH_MS;
    if (count >= THIN && fresh) return; // bank is healthy — skip
    // Fire and forget; log only.
    researchCompanyQuestions({ companyId, companyName: company.name })
      .then((r) => { if (r.added) console.log(`🔎 research: +${r.added} questions for ${company.name}`); })
      .catch(() => {});
  } catch { /* best-effort */ }
}

module.exports = { researchCompanyQuestions, maybeResearchCompany, ALLOW_DOMAINS };
