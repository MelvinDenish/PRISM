# Portable image for the PRISM GD AI Panelist. CPU-only — the heavy models (LLM,
# STT, TTS) run behind HTTP endpoints, so this container is light and runs on any
# host (Fly.io / Render / Railway / DigitalOcean / Hetzner / k8s / a bare VM).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent.py .

# Pre-download the VAD / turn-detector model weights into the image so the first
# job doesn't pay a cold download. Safe no-op if the files are already cached.
RUN python agent.py download-files || true

# `start` connects to LiveKit and waits for room dispatch.
CMD ["python", "agent.py", "start"]
