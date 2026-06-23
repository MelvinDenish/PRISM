# PRISM backend image — Express + Socket.IO + Puppeteer (Chromium for resume PDFs).
# Built and run by deploy/docker-compose.deploy.yml on the AWS box.
#
# We install Debian's Chromium package and point Puppeteer at it
# (PUPPETEER_SKIP_DOWNLOAD), instead of letting Puppeteer download its own build
# during `npm ci` — that download from Puppeteer's CDN is flaky and was failing
# the image build. The apt package also pulls in all the shared libs Chromium
# needs. Chromium runs headless with --no-sandbox --disable-dev-shm-usage (set in
# server/agent/services/resumePdf.js), so running as root in the container is fine.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Use the system Chromium; skip Puppeteer's own download.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Install prod deps first for layer caching (Puppeteer's postinstall no-ops now).
COPY package*.json ./
RUN npm ci --omit=dev

# App source (node_modules excluded via .dockerignore so the installed deps survive).
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
