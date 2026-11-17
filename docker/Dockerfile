# syntax=docker/dockerfile:1.7

# ==============================================================================
# Stage 1: Build & unpack the Linux Electron application
# ==============================================================================
FROM node:20-bookworm AS builder

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json electron.vite.config.ts electron-builder.config.cjs tailwind.config.ts postcss.config.js ./
COPY build ./build
COPY resources ./resources
COPY src ./src

RUN npm run build && \
    npx electron-builder --linux dir --config electron-builder.config.cjs --publish never

# ==============================================================================
# Stage 2: Browser-streamed desktop runtime via LinuxServer Selkies (Wayland)
# ==============================================================================
FROM ghcr.io/linuxserver/baseimage-selkies:ubuntunoble

ARG BUILD_VERSION="1.0.0"

LABEL org.opencontainers.image.title="Semply Ebook Reader" \
      org.opencontainers.image.description="Fast, local-first EPUB and PDF desktop reader with offline MuPDF WASM reflow, streamed directly to your browser." \
      org.opencontainers.image.url="https://semply.app" \
      org.opencontainers.image.source="https://github.com/ederaefe/EPUB-Reader-Desktop" \
      org.opencontainers.image.documentation="https://semply.app/docs" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${BUILD_VERSION}"

ENV TITLE="Semply Ebook Reader" \
    PIXELFLUX_WAYLAND=true \
    SELKIES_DESKTOP=false \
    NO_DECOR=true

# Install Electron / Chromium shared runtime libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libasound2t64 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libatspi2.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libgbm1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      fonts-liberation \
      fonts-dejavu-core && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/tmp/* /tmp/*

COPY --from=builder /workspace/release/linux-unpacked /opt/semply
COPY docker/root /

# Normalize line endings (safe for Windows checkouts) and set executable permissions
RUN sed -i 's/\r$//' /defaults/autostart_wayland && \
    chmod +x /defaults/autostart_wayland && \
    mkdir -p /books

EXPOSE 3000 3001
VOLUME ["/config", "/books"]
