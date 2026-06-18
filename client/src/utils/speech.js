/**
 * Browser speech-to-text helper for the live GD — best-effort dictation of the
 * LOCAL user's own mic (SpeechRecognition; Chrome/Edge only). Used to capture what
 * the user said so they get content feedback. Degrades to silence where unsupported.
 *
 * NOTE: the moderator's VOICE is now the real AI panelist — the `voice-agent`
 * service that joins the LiveKit room — so the old browser text-to-speech
 * (speak / cancelSpeech / isTTSSupported) has been removed.
 */

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
