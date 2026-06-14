import { useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { speak, cancelSpeech, createDictation, isTTSSupported } from '../../utils/speech';

/**
 * The live-GD AI moderator. Mounts INSIDE <LiveKitRoom> (via LiveRoom's children
 * slot) so it can use LiveKit hooks. Each participant runs their own copy on their
 * own device — so the spoken guidance plays locally for everyone.
 *
 * Responsibilities:
 *  - On start: turn the local camera + mic on, begin best-effort dictation of the
 *    local mic, and speak the intro + topic.
 *  - Track per-participant speaking time + turns from LiveKit active-speaker data.
 *  - Speak timed guidance (halfway / 1-minute) and nudge anyone who hasn't spoken.
 *  - On end: stop dictation and report THIS user's participation + transcript up.
 *
 * Props:
 *   started, ended  booleans driving lifecycle
 *   topic           revealed GD topic
 *   durationMin     total minutes
 *   remaining       seconds left (parent countdown) — drives timed guidance
 *   myUserId        the local user's id (to pick out their own stats)
 *   onModeratorLine (line) => void   latest spoken line, for an on-screen caption
 *   onReport ({spokenSeconds,turns,spokePct}, transcript) => void  fired once at end
 */

// LiveKit identity is `${userId}-${randomHex}` (see server/routes/rtc.js). Recover
// the userId by stripping the trailing "-<hex>" suffix.
const parseUserId = (identity = '') => {
  const i = String(identity).lastIndexOf('-');
  return i > 0 ? identity.slice(0, i) : identity;
};

const remoteParticipantsOf = (room) => {
  const m = room?.remoteParticipants || room?.participants; // v2 vs older
  return m && typeof m.values === 'function' ? [...m.values()] : [];
};

// The optional server-side AI panelist (the `voice-agent` service) joins each GD
// room with an identity that STARTS WITH this prefix. When it is present it does
// ALL the speaking, so the local browser-TTS moderator stays silent and the agent
// is excluded from the speaking-time stats. When it is absent, everything below
// behaves exactly as before (graceful degradation — the GD never depends on it).
const AGENT_IDENTITY_PREFIX = 'panelist';
const isAgentIdentity = (identity) => String(identity || '').startsWith(AGENT_IDENTITY_PREFIX);

const GdModerator = ({ started, ended, topic, durationMin = 10, remaining, myUserId, isHost = false, onModeratorLine, onReport }) => {
  const room = useRoomContext();
  const statsRef = useRef(new Map()); // uid -> { name, seconds, turns, speakingNow }
  const dictationRef = useRef(null);
  const flags = useRef({ intro: false, half: false, oneMin: false, reported: false, nudged: new Set() });
  const [caption, setCaption] = useState('');
  // Mirror `remaining` into a ref so the 1s tracking interval can read it WITHOUT
  // listing `remaining` in its deps — otherwise the parent's per-second countdown
  // would tear down and recreate the interval every second (unreliable accrual).
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  // Flips true once a real AI panelist (the voice-agent) is detected in the room.
  const [agentActive, setAgentActive] = useState(false);
  const agentActiveRef = useRef(false);

  const say = (line) => {
    // If a real AI panelist is in the room, it owns the voice — stay silent so we
    // never double-speak over it (and show no scripted caption).
    if (agentActiveRef.current) return;
    setCaption(line);
    onModeratorLine?.(line);
    speak(line);
  };

  // Broadcast the revealed topic to the room so the AI panelist (if deployed) can
  // open on it. Host-only + best-effort; a no-op/harmless when no agent is listening.
  const publishTopic = () => {
    if (!isHost || !topic || !room?.localParticipant?.publishData) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'gd-topic', topic, durationMin }));
      room.localParticipant.publishData(payload, { reliable: true, topic: 'gd-meta' });
    } catch { /* data channel not ready — the agent also has a generic opener */ }
  };

  // ── Auto camera + mic on, and start dictation, when the GD starts ──
  useEffect(() => {
    if (!started || !room?.localParticipant) return;
    (async () => {
      try { await room.localParticipant.setCameraEnabled(true); } catch { /* perms */ }
      try { await room.localParticipant.setMicrophoneEnabled(true); } catch { /* perms */ }
    })();
    if (!dictationRef.current) {
      dictationRef.current = createDictation();
      dictationRef.current.start();
    }
  }, [started, room]);

  // ── Send the topic to the AI panelist (if any) as soon as the GD starts ──
  useEffect(() => {
    if (started && topic) publishTopic();
  }, [started, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Intro line once the topic is known ──
  // Fires immediately — IDENTICAL to the no-agent behaviour (graceful degradation
  // path is unchanged). If an AI panelist is in the room, `say()` early-returns and
  // the tick's cancelSpeech() cuts any line already speaking, so the agent leads.
  useEffect(() => {
    if (!started || !topic || flags.current.intro) return;
    flags.current.intro = true;
    say(`Welcome to the group discussion. Today's topic is: ${topic}. You have ${durationMin} minutes. State your view early, back it with a reason and an example, and make sure everyone gets a turn. Let's begin — who would like to open?`);
  }, [started, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Accumulate per-participant speaking time (1s granularity) ──
  useEffect(() => {
    if (!started || ended || !room) return;
    const tick = setInterval(() => {
      const remotes = remoteParticipantsOf(room);
      // Detect the AI panelist. Once present: silence the local moderator, drop any
      // queued scripted line, and (re)send the topic in case it joined late.
      const agent = remotes.find((p) => isAgentIdentity(p.identity));
      if (agent && !agentActiveRef.current) {
        agentActiveRef.current = true;
        setAgentActive(true);
        cancelSpeech();
        publishTopic();
      }
      // The agent is never a "participant" for stats/nudging purposes.
      const everyone = [room.localParticipant, ...remotes].filter((p) => p && !isAgentIdentity(p.identity));
      everyone.forEach((p) => {
        const uid = parseUserId(p.identity);
        const entry = statsRef.current.get(uid) || { name: p.name || '', seconds: 0, turns: 0, speakingNow: false };
        if (p.name) entry.name = p.name;
        const speaking = !!p.isSpeaking;
        if (speaking) {
          entry.seconds += 1;
          if (!entry.speakingNow) entry.turns += 1;
        }
        entry.speakingNow = speaking;
        statsRef.current.set(uid, entry);
      });

      // Nudge a participant who has stayed silent (after a 60s warm-up), once each.
      const elapsed = durationMin * 60 - (remainingRef.current ?? durationMin * 60);
      if (elapsed > 60 && statsRef.current.size > 1) {
        for (const [uid, e] of statsRef.current) {
          if (e.seconds < 3 && !flags.current.nudged.has(uid)) {
            flags.current.nudged.add(uid);
            say(`Let's hear from ${e.name || 'someone who hasn\'t spoken yet'}. What's your take on this?`);
            break; // one nudge per tick
          }
        }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [started, ended, room, durationMin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timed guidance from the parent countdown ──
  useEffect(() => {
    if (!started || ended || remaining == null) return;
    const half = Math.round((durationMin * 60) / 2);
    if (remaining <= half && remaining > half - 2 && !flags.current.half) {
      flags.current.half = true;
      say('You are halfway through. If you have not spoken yet, now is the time. Start moving toward concrete points.');
    }
    if (remaining <= 60 && remaining > 58 && !flags.current.oneMin) {
      flags.current.oneMin = true;
      say('One minute left. Begin summarizing and offer a brief conclusion.');
    }
  }, [started, ended, remaining, durationMin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On end: stop dictation, report this user's stats + transcript once ──
  useEffect(() => {
    if (!ended || flags.current.reported) return;
    flags.current.reported = true;
    dictationRef.current?.stop();
    say('Time is up. Generating your feedback now.');

    const total = [...statsRef.current.values()].reduce((s, e) => s + e.seconds, 0) || 1;
    const mine = statsRef.current.get(String(myUserId)) || { seconds: 0, turns: 0 };
    const spokePct = Math.round((mine.seconds / total) * 100);
    onReport?.(
      { spokenSeconds: mine.seconds, turns: mine.turns, spokePct },
      dictationRef.current?.getTranscript?.() || '',
    );
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount.
  useEffect(() => () => { dictationRef.current?.stop(); cancelSpeech(); }, []);

  // A real AI panelist is talking (over its own audio track) but we have no local
  // caption for it — show a small "live" badge instead of the scripted bubble.
  if (agentActive && !caption) {
    return (
      <div style={{
        position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
        padding: '6px 14px', borderRadius: 999, zIndex: 5, background: 'rgba(16,185,129,0.92)',
        color: '#04110d', fontSize: 12, fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
      }}>
        🎙️ AI panelist is leading the discussion
      </div>
    );
  }

  if (!caption) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      maxWidth: '80%', padding: '8px 16px', borderRadius: 999, zIndex: 5,
      background: 'rgba(16,185,129,0.92)', color: '#04110d', fontSize: 13, fontWeight: 600,
      boxShadow: '0 6px 24px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span aria-hidden>{isTTSSupported() ? '🔊' : '💬'}</span>
      <span>{caption}</span>
    </div>
  );
};

export default GdModerator;
