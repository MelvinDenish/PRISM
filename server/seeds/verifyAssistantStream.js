/**
 * verifyAssistantStream.js — unit checks for the streaming agent loop.
 *
 * Pure logic test: stubs llm.chatStream / llm.chat (no provider) and a couple of
 * tool handlers (no DB), then asserts the new behaviour from this pass:
 *   T1  parallel read tools + 'tool' event + token streaming → reply
 *   T2  write proposals get a stable id (for the /confirm executed-marker)
 *   T3  per-tool error isolation (one tool throws, Promise.all not aborted)
 *   T4  'reset' emitted when a token-emitting turn resolves to tool calls
 *   T5  non-streaming runAgent still works (shared executeToolCalls path)
 *
 * Run: node seeds/verifyAssistantStream.js   (no MONGODB_URI / LLM keys needed)
 */

const assert = require('assert');
const llm = require('../agent/llm');
const { TOOLS } = require('../agent/tools');
const { runAgent, runAgentStream } = require('../agent/runAgent');

// --- stub tool handlers so nothing touches Mongo --------------------------------
TOOLS.list_topics.handler = async () => [{ id: 't1', name: 'DSA' }];
TOOLS.list_companies.handler = async () => [{ id: 'c1', name: 'Amazon' }];
TOOLS.apply_theme.handler = () => ({ type: 'apply_theme', title: 'Apply', summary: 's', params: { theme: { hue: 200 } } });

const fc = (name, args = '{}', id = name) => ({ id, type: 'function', function: { name, arguments: args } });

// Build a fake streaming chat from a scripted sequence of turns.
function fakeStream(seq) {
  let i = 0;
  return async ({ onToken }) => {
    const step = seq[i++];
    if (step.tokens && onToken) for (const t of step.tokens) onToken(t);
    return step.message;
  };
}
function fakeChat(seq) {
  let i = 0;
  return async () => seq[i++].message;
}

(async () => {
  // T1 — parallel reads, tool event, token streaming -----------------------------
  llm.chatStream = fakeStream([
    { message: { role: 'assistant', content: '', tool_calls: [fc('list_topics', '{}', 'a'), fc('list_companies', '{}', 'b')] } },
    { tokens: ['Hel', 'lo'], message: { role: 'assistant', content: 'Hello' } },
  ]);
  const ev1 = [];
  const r1 = await runAgentStream({ messages: [{ role: 'user', content: 'hi' }], userId: 'u1', role: 'mentee', onEvent: (e) => ev1.push(e) });
  const toolEv = ev1.find((e) => e.type === 'tool');
  assert(toolEv && toolEv.names.includes('list_topics') && toolEv.names.includes('list_companies'), 'T1: tool event lists both tools');
  assert.strictEqual(ev1.filter((e) => e.type === 'token').map((e) => e.delta).join(''), 'Hello', 'T1: token deltas concat to reply');
  assert.strictEqual(r1.reply, 'Hello', 'T1: final reply');
  assert.deepStrictEqual([...r1.toolsUsed].sort(), ['list_companies', 'list_topics'], 'T1: both tools used');
  console.log('✓ T1 parallel reads + tool event + token streaming');

  // T2 — write proposal gets a stable id ----------------------------------------
  llm.chatStream = fakeStream([
    { message: { role: 'assistant', content: '', tool_calls: [fc('apply_theme', '{"request":"ocean"}', 'w')] } },
    { tokens: ['done'], message: { role: 'assistant', content: 'done' } },
  ]);
  const r2 = await runAgentStream({ messages: [{ role: 'user', content: 'theme' }], userId: 'u1', role: 'mentee', onEvent: () => {} });
  assert.strictEqual(r2.proposedActions.length, 1, 'T2: one proposal');
  assert(typeof r2.proposedActions[0].id === 'string' && r2.proposedActions[0].id.length > 0, 'T2: proposal stamped with id');
  console.log('✓ T2 write proposal carries a stable id');

  // T3 — per-tool error isolation -----------------------------------------------
  TOOLS.list_companies.handler = async () => { throw new Error('boom'); };
  llm.chatStream = fakeStream([
    { message: { role: 'assistant', content: '', tool_calls: [fc('list_topics', '{}', 'a'), fc('list_companies', '{}', 'b')] } },
    { tokens: ['ok'], message: { role: 'assistant', content: 'ok' } },
  ]);
  const r3 = await runAgentStream({ messages: [{ role: 'user', content: 'x' }], userId: 'u1', role: 'mentee', onEvent: () => {} });
  assert.strictEqual(r3.reply, 'ok', 'T3: run completes despite one tool throwing');
  TOOLS.list_companies.handler = async () => [{ id: 'c1', name: 'Amazon' }]; // restore
  console.log('✓ T3 per-tool error isolation (Promise.all not aborted)');

  // T4 — reset on a token-then-toolcall turn ------------------------------------
  llm.chatStream = fakeStream([
    { tokens: ['stray'], message: { role: 'assistant', content: 'stray', tool_calls: [fc('list_topics', '{}', 'a')] } },
    { tokens: ['final'], message: { role: 'assistant', content: 'final' } },
  ]);
  const ev4 = [];
  const r4 = await runAgentStream({ messages: [{ role: 'user', content: 'y' }], userId: 'u1', role: 'mentee', onEvent: (e) => ev4.push(e) });
  assert(ev4.some((e) => e.type === 'reset'), 'T4: reset emitted on mixed turn');
  assert.strictEqual(r4.reply, 'final', 'T4: final reply after reset');
  console.log('✓ T4 reset emitted when streamed text turns out to be a tool turn');

  // T5 — non-streaming runAgent still works -------------------------------------
  llm.chat = fakeChat([
    { message: { role: 'assistant', content: '', tool_calls: [fc('list_topics', '{}', 'a')] } },
    { message: { role: 'assistant', content: 'classic path ok' } },
  ]);
  const r5 = await runAgent({ messages: [{ role: 'user', content: 'z' }], userId: 'u1', role: 'mentee' });
  assert.strictEqual(r5.reply, 'classic path ok', 'T5: non-stream runAgent returns reply');
  assert.deepStrictEqual(r5.toolsUsed, ['list_topics'], 'T5: tool used on non-stream path');
  console.log('✓ T5 non-streaming runAgent still works');

  console.log('\nALL STREAM CHECKS PASSED (5/5)');
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
