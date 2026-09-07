# MiniPlayer — Frontend

Welcome to MiniPlayer — a lightweight frontend for a fast, offline-friendly music streaming experience.

## Features

- Now Playing, Search, Library (configured via `manifest.json` shortcuts)
- Separate caching for audio and assets to keep storage controlled
- Partial precache: single file failures don't block service worker installation
- Friendly update notifications with a "Refresh" button

## Quick demo
Open `index.html` in a modern browser. Play a track, then go offline to see playback continue from cache.

## Quick start

```bash
npx http-server .
# or: live-server
```

Open `http://localhost:8080` and check DevTools → Application → Service Workers.

## How it works (brief)

- Service worker precaches files individually into a static cache.
- Audio assets are stored in a separate `miniplayer-audio-v1` cache with LRU trimming.
- Navigation uses a network-first strategy with a cache fallback when offline.

## Contributing

Open issues for bugs or feature requests. Pull requests welcome — please include testing notes.

---
