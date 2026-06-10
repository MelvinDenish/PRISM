# Live Video Runbook (self-hosted LiveKit SFU)

PRISM live video — 1:1 mentorship, technical interviews, group discussion, and
1-to-many webinars — runs on a **self-hosted [LiveKit](https://livekit.io) SFU**.
The SFU forwards each participant's stream once to the server, which fans it out;
this replaces the old PeerJS full-mesh (where every peer connected to every other
peer) and adds **TURN** so users behind strict NAT/CGNAT can connect.

```
browser ⇄ (WebSocket signaling :7880)            ┌── LiveKit SFU ──┐
browser ⇄ (WebRTC media UDP 50000-50100 / TURN)  │  rooms, tracks  │
                                                 └─────────────────┘
PRISM server  ──mints JWT room token (livekit-server-sdk)──▶ browser
        POST /api/rtc/token   (auth + room authorization reused from app)
```

## Architecture in this repo
- **Infra:** `deploy/docker-compose.livekit.yml` + `deploy/livekit.yaml`.
- **Server:** `server/routes/rtc.js` issues a room-scoped access token. It reuses
  the **existing authorization** — `MentorshipSession` membership for `session:*`
  rooms, `GDRoom` for `gd:*` rooms — and sets publish/subscribe grants from the
  user's role. The client never chooses its own permissions.
- **Client:** `client/src/components/rtc/LiveRoom.jsx` wraps
  `@livekit/components-react`; `VideoCall`, `TechnicalInterview`, and `GDRooms`
  render it. Publish controls appear only when the token grants `canPublish`
  (so webinar viewers are subscribe-only).

## Room & role model
| Context | Room name | Who can publish | Topology |
| ------- | --------- | --------------- | -------- |
| 1:1 mentorship | `session:<sessionId>` | mentor + mentee | 1-1 |
| Technical interview | `session:<sessionId>` | mentor + mentee | 1-1 |
| Group discussion | `gd:<roomId>` | all participants | n-n |
| Webinar (1-to-many) | `gd:<roomId>` with GDRoom `mode='webinar'` | host (room owner / mentor) only; others subscribe | 1-n |

## Run it (dev)
1. Start the SFU:
   ```bash
   docker compose -f deploy/docker-compose.livekit.yml up -d
   ```
2. In `server/.env` (values must match `deploy/livekit.yaml`):
   ```bash
   LIVEKIT_WS_URL=ws://localhost:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=devsecret_change_me_to_a_long_random_string
   ```
3. Restart the PRISM server. Open a mentorship session / GD room in two browsers →
   bidirectional audio+video. `/api/rtc/token` returns **503** if the three env
   vars are unset (video cleanly disabled), **403** if the caller isn't a member
   of the requested room.

## Generate real keys (anything not your laptop)
```bash
docker run --rm livekit/livekit-server generate-keys
```
Put the pair in BOTH `deploy/livekit.yaml` (`keys:`) and `server/.env`.

## Required ports
| Port | Proto | Purpose |
| ---- | ----- | ------- |
| 7880 | TCP | WebSocket signaling (the client `LIVEKIT_WS_URL`) |
| 7881 | TCP | media fallback when UDP is blocked |
| 3478 | UDP | embedded TURN |
| 50000–50100 | UDP | WebRTC media |

## Production notes
- **External IP:** set `rtc.use_external_ip: true` (and/or `node_ip`) in
  `livekit.yaml` so remote peers get a reachable ICE candidate.
- **TLS / wss:** terminate TLS (a domain + cert, or a reverse proxy) and use
  `wss://` for `LIVEKIT_WS_URL`. Enable TURN TLS (`5349`) for locked-down networks.
- **Scale:** LiveKit needs **Redis** to run multi-node — single node (this compose)
  is fine for a college deployment. Add Redis only when you outgrow one box.
- **Webhooks (optional, future):** LiveKit can POST room/participant events to the
  server for server-side presence/recording. Not wired here — the client reads
  participant join/leave from the room directly.
