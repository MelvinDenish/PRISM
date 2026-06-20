# PRISM backend image — Express + Socket.IO + Puppeteer (Chromium for resume PDFs).
# Built and run by deploy/docker-compose.deploy.yml on the AWS box.
# Chromium runs headless with --no-sandbox --disable-dev-shm-usage (set in
# server/agent/services/resumePdf.js), which is why running as root in the
# container is fine here.
FROM node:20-bookworm-slim

# System libraries Chromium needs at runtime. Puppeteer downloads its OWN matched
# Chromium build during `npm ci` (below) — we only provide the shared libs + fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
      libdrm2 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 \
      libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Keep Puppeteer's Chromium inside the workdir so the same path resolves at build
# AND runtime (default cache is $HOME/.cache which can drift between stages/users).
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV NODE_ENV=production

# Install prod deps first for layer caching. Puppeteer's postinstall fetches
# Chromium into PUPPETEER_CACHE_DIR here.
COPY package*.json ./
RUN npm ci --omit=dev

# App source (node_modules + .cache excluded via .dockerignore so the installed
# deps and downloaded Chromium are not clobbered by the build context).
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
