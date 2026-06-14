import { useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { createDictation } from '../../utils/speech';

/**
 * Live-GD helper. Mounts INSIDE <LiveKitRoom>. The spoken moderation is now done
 * ENTIRELY by the real AI panelist (the `voice-agent` service that joins the room),
 * so this component NO LONGER speaks — the old robotic browser text-to-speech has
 * been removed. It just:
 *  - turns the local camera + mic on when the GD starts,
 *  - best-effort transcribes the LOCAL user's own mic (for their feedback),
 *  - tracks per-participant speaking time/turns (excluding the AI agent),
 *  - publishes the topic to the room so the AI panelist can open on it,
 *  - on end, reports THIS user's participation + transcript up for scoring.
 * It renders nothing.
 *
 * Props: started, ended, topic, durationMin, myUserId, isHost, onReport
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

// The AI panelist (the voice-agent) joins as a LiveKit AGENT participant. Exclude it
// from the speaking-time stats so it never dilutes a real user's share of airtime.
const isAgentParticipant = (p) =>
  p?.isAgent === true || /^(agent|panelist)/i.test(String(p?.identity || ''));

const GdModerator = ({ started, ended, topic, durationMin = 10, myUserId, isHost = false, onReport }) => {
  const room = useRoomContext();
  const statsRef = useRef(new Map()); // uid -> { name, seconds, turns, speakingNow }
  const dictationRef = useRef(null);
  const reportedRef = useRef(false);

  // Publish the revealed topic to the room so the AI panelist can open on it.
  // Host-only + best-effort; harmless when no agent is listening.
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

  // ── Send the topic to the AI panelist as soon as the GD starts ──
  useEffect(() => {
    if (started && topic) publishTopic();
  }, [started, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Accumulate per-participant speaking time (1s granularity), agent excluded ──
  useEffect(() => {
    if (!started || ended || !room) return;
    const tick = setInterval(() => {
      const everyone = [room.localParticipant, ...remoteParticipantsOf(room)]
        .filter((p) => p && !isAgentParticipant(p));
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
    }, 1000);
    return () => clearInterval(tick);
  }, [started, ended, room]);

  // ── On end: stop dictation, report this user's stats + transcript once ──
  useEffect(() => {
    if (!ended || reportedRef.current) return;
    reportedRef.current = true;
    dictationRef.current?.stop();

    const total = [...statsRef.current.values()].reduce((s, e) => s + e.seconds, 0) || 1;
    const mine = statsRef.current.get(String(myUserId)) || { seconds: 0, turns: 0 };
    const spokePct = Math.round((mine.seconds / total) * 100);
    onReport?.(
      { spokenSeconds: mine.seconds, turns: mine.turns, spokePct },
      dictationRef.current?.getTranscript?.() || '',
    );
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount.
  useEffect(() => () => { dictationRef.current?.stop(); }, []);

  return null;
};

export default GdModerator;
