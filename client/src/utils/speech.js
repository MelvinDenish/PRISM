/**
 * Browser Web Speech helpers for the live GD AI moderator — zero cost, zero
 * dependency, no API key.
 *
 *  - speak(text)        → text-to-speech (SpeechSynthesis). The moderator's voice.
 *  - createDictation()  → best-effort speech-to-text of the LOCAL user's own mic
 *                         (SpeechRecognition; Chrome/Edge only). Used to give
 *                         content feedback; degrades to silence elsewhere.
 *
 * Everything no-ops gracefully when unsupported, so the GD never breaks — the
 * caller falls back to on-screen text / participation-only feedback.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Voices load async in most browsers; warm the list so speak() can pick one.
let _voices = [];
function _loadVoices() {
  if (!synth) return;
  _voices = synth.getVoices() || [];
}
if (synth) {
  _loadVoices();
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', _loadVoices);
}

export const isTTSSupported = () => Boolean(synth && typeof window.SpeechSynthesisUtterance !== 'undefined');

/**
 * Speak `text` aloud. Returns true if speech was dispatched, false if unsupported.
 * Utterances queue naturally; call cancelSpeech() to clear the queue (e.g. on leave).
 */
export function speak(text) {
  if (!isTTSSupported() || !text) return false;
  try {
    const u = new window.SpeechSynthesisUtterance(String(text));
    u.lang = 'en-US';
    u.rate = 1;
    u.pitch = 1;
    const v = _voices.find((vc) => /^en[-_]/i.test(vc.lang)) || _voices[0];
    if (v) u.voice = v;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function cancelSpeech() {
  try { synth?.cancel(); } catch { /* ignore */ }
}

const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export const isDictationSupported = () => Boolean(SpeechRecognitionCtor);

/**
 * Continuously transcribe the local user's microphone. Returns a small controller:
 *   { supported, start(), stop(), getTranscript() }
 * Final results are accumulated into one string. Recognition auto-restarts when the
 * engine pauses on silence (so a whole discussion is captured), and stops for good
 * on a permission error or an explicit stop().
 */
export function createDictation() {
  if (!SpeechRecognitionCtor) {
    return { supported: false, start() {}, stop() {}, getTranscript: () => '' };
  }
  const rec = new SpeechRecognitionCtor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';

  let transcript = '';
  let running = false;
  let stopped = false;

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal && r[0]?.transcript) transcript += `${r[0].transcript.trim()} `;
    }
  };
  rec.onend = () => {
    running = false;
    // The engine stops itself on silence; restart unless we were told to stop.
    if (!stopped) {
      try { rec.start(); running = true; } catch { /* will retry on next end */ }
    }
  };
  rec.onerror = (e) => {
    // Permission/availability errors are terminal — don't busy-loop restarting.
    if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') stopped = true;
  };

  return {
    supported: true,
    start() {
      stopped = false;
      if (!running) {
        try { rec.start(); running = true; } catch { /* already starting */ }
      }
    },
    stop() {
      stopped = true;
      try { rec.stop(); } catch { /* ignore */ }
    },
    getTranscript: () => transcript.trim(),
  };
}
