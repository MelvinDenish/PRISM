/* Run: node server/seeds/prefetchResumeFonts.js
 *
 * Warms the resume webfont cache (server/agent/services/fonts/) with a curated set of
 * high-quality, OFL/Apache design fonts so the most common AI picks inline instantly with
 * no render-time fetch. NOT required — resumeFonts.js fetches + caches any font on demand;
 * this just primes the cache. Safe to re-run (cache hits are skipped).
 */
const { prefetchFamilies, CACHE_DIR } = require('../agent/services/resumeFonts');

// Curated for resumes: clean sans for body, expressive serif/display for headings, a few
// monos. All present on the Fontsource jsDelivr mirror (Google Fonts superset, OFL/Apache).
const FAMILIES = [
  // Sans
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Work Sans',
  'Source Sans 3', 'IBM Plex Sans', 'Manrope', 'DM Sans', 'Space Grotesk',
  'Plus Jakarta Sans', 'Figtree', 'Outfit', 'Archivo', 'Sora', 'Public Sans',
  // Serif
  'Merriweather', 'Lora', 'Playfair Display', 'Source Serif 4', 'Newsreader', 'Fraunces',
  'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville', 'Bitter', 'Spectral',
  'Crimson Pro', 'Domine', 'IBM Plex Serif',
  // Mono
  'JetBrains Mono', 'IBM Plex Mono', 'Space Mono',
];

(async () => {
  console.log(`Prefetching ${FAMILIES.length} font families into ${CACHE_DIR} …`);
  const t0 = Date.now();
  const ok = await prefetchFamilies(FAMILIES);
  console.log(`\nprefetchResumeFonts: ${ok}/${FAMILIES.length} families cached (${((Date.now() - t0) / 1000).toFixed(1)}s).`);
  if (ok < FAMILIES.length) console.log('(misses are fine — they fall back to system fonts and are retried on demand.)');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
