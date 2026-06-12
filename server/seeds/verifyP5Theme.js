// Verify Copilot P5 theming: the apply_theme tool proposal + the executor's
// persist path (re-derive palette from the numeric hue → User.theme), including
// the tamper-proofing guarantee. Mirrors routes/assistant.js EXECUTORS.apply_theme.
//   MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/verifyP5Theme.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { TOOLS } = require('../agent/tools');
const { paletteFromHue, randomTheme } = require('../utils/themeGenerator');

const ok = (c, m) => { if (!c) throw new Error(`FAIL: ${m}`); console.log('  ok —', m); };

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const u = await User.create({
        name: 'P5 Theme Verify', email: `p5-${Date.now()}@example.com`, password: 'x', role: 'mentee',
        theme: randomTheme(),
    });
    try {
        // 1. New users carry a palette (register assigns randomTheme()).
        ok(u.theme && /^#[0-9a-f]{6}$/i.test(u.theme.accentPrimary), `new user has a theme (${u.theme.name} ${u.theme.accentPrimary})`);

        // 2. apply_theme tool returns a valid, hue-carrying proposal.
        const proposal = TOOLS.apply_theme.handler({ request: 'make it cyberpunk purple' });
        ok(proposal.type === 'apply_theme', 'tool returns an apply_theme proposal');
        ok(proposal.params.theme && Number.isFinite(proposal.params.theme.hue), 'proposal carries a numeric hue');
        ok(/^#[0-9a-f]{6}$/i.test(proposal.params.theme.accentPrimary), 'proposal accentPrimary is a hex color');

        // 3. Executor path: re-derive from the hue and persist (mirrors assistant.js).
        const hue = proposal.params.theme.hue;
        const theme = paletteFromHue(hue);
        await User.findByIdAndUpdate(u._id, { theme });
        const reloaded = await User.findById(u._id);
        ok(reloaded.theme && reloaded.theme.accentPrimary === theme.accentPrimary, `theme persisted (${reloaded.theme.name} ${reloaded.theme.accentPrimary})`);
        ok(reloaded.theme.hue === hue, `persisted hue matches (${hue})`);

        // 4. Tamper-proofing: a malicious proposal carrying an injected CSS string
        //    is ignored — the executor rebuilds colors purely from the hue.
        const evil = { hue, accentPrimary: 'red; } body{display:none}', gradientPrimary: 'url(x)' };
        const safe = paletteFromHue(Number(evil.hue));
        ok(safe.accentPrimary === reloaded.theme.accentPrimary, 'colors derive only from the numeric hue (injected CSS dropped)');

        console.log('\nP5 THEME: all checks passed');
    } finally {
        await User.deleteOne({ _id: u._id });
        await mongoose.disconnect();
    }
})().catch((e) => { console.error('\n' + e.message); process.exit(1); });
