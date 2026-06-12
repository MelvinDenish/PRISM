/**
 * Per-user theme generator (Copilot P5).
 *
 * Produces a BOUNDED set of accent + gradient override tokens from a single base
 * hue. It deliberately never touches background/text colors — the dark/light
 * system owns those — so a generated palette can recolor the brand without ever
 * breaking contrast/readability. Accents sit in a mid-lightness band (L≈52–66%)
 * so they read on both the ivory (light) and charcoal (dark) surfaces.
 *
 * The stored object is also the on-the-wire contract with the client theme
 * applier (client/src/utils/theme.js) and the index.html pre-paint script.
 */

// HSL (h 0–360, s/l 0–100) → #rrggbb.
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Hue → human label (nearest on the wheel).
const HUE_NAMES = [
  [4, 'Crimson'], [22, 'Ember'], [32, 'Amber'], [45, 'Gold'], [95, 'Lime'],
  [140, 'Emerald'], [168, 'Teal'], [188, 'Cyan'], [212, 'Azure'], [240, 'Sapphire'],
  [258, 'Indigo'], [278, 'Violet'], [295, 'Amethyst'], [320, 'Magenta'], [335, 'Rose'],
];
function nameForHue(h) {
  let best = HUE_NAMES[0];
  let bestD = Infinity;
  for (const entry of HUE_NAMES) {
    const d = Math.min(Math.abs(entry[0] - h), 360 - Math.abs(entry[0] - h));
    if (d < bestD) { bestD = d; best = entry; }
  }
  return best[1];
}

/**
 * Build the bounded token object from a base hue (0–359). The CTA accent uses a
 * contrasting hue so primary vs. action stay visually distinct.
 */
function paletteFromHue(rawHue) {
  const hue = ((Math.round(Number(rawHue)) % 360) + 360) % 360;
  const actionHue = (hue + 165) % 360;
  const accentPrimary = hslToHex(hue, 62, 56);
  const accentPrimaryStrong = hslToHex(hue, 66, 66);
  const accentSecondary = hslToHex((hue + 22) % 360, 46, 52);
  const accentAction = hslToHex(actionHue, 70, 55);
  const accentActionStrong = hslToHex(actionHue, 72, 47);
  return {
    name: nameForHue(hue),
    hue,
    accentPrimary,
    accentPrimaryStrong,
    accentSecondary,
    accentAction,
    accentActionStrong,
    gradientPrimary: `linear-gradient(135deg, ${accentPrimaryStrong}, ${accentPrimary})`,
  };
}

function randomTheme() {
  return paletteFromHue(Math.floor(Math.random() * 360));
}

// Natural-language request → hue. First keyword wins; falls back to random.
const KEYWORD_HUES = [
  [/purple|violet|amethyst|lavender|grape/i, 278],
  [/cyber|cyberpunk|neon|electric/i, 295],
  [/cyan|aqua|turquoise|ice|frost/i, 188],
  [/teal/i, 168],
  [/blue|azure|ocean|sky|sapphire|navy/i, 212],
  [/indigo|midnight/i, 250],
  [/green|emerald|forest|mint|matrix|jade/i, 140],
  [/lime|chartreuse/i, 95],
  [/gold|golden|amber|honey|bronze/i, 45],
  [/orange|sunset|tangerine|coral/i, 26],
  [/red|crimson|ruby|scarlet|fire/i, 4],
  [/pink|rose|blush|salmon/i, 335],
  [/magenta|fuchsia|hot pink/i, 320],
  [/warm|cozy/i, 30],
  [/cool|calm/i, 205],
];
function themeFromPrompt(text = '') {
  for (const [re, hue] of KEYWORD_HUES) {
    if (re.test(text)) return paletteFromHue(hue);
  }
  return randomTheme();
}

module.exports = { randomTheme, themeFromPrompt, paletteFromHue, hslToHex, nameForHue };
