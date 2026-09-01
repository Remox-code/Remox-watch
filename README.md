# WatchFlow

A frontend-only anime/TV watch tracker powered by TMDB.

## Setup

1. Create a TMDB account.
2. From your TMDB account settings, request an API key.
3. Open `index.html`.
4. Click the `⚙` button.
5. Paste your TMDB API key and save.
6. Search for an anime or TV show.
7. Select a result and choose season + last watched episode.
8. Your list is stored in the browser's localStorage.

## Files

- `index.html` — page structure
- `style.css` — UI
- `config.js` — optional API key configuration
- `app.js` — search, TMDB requests, seasons, library, progress, filters and localStorage

## Important

This is a client-side project. If you put a TMDB API key directly in `config.js` and publish the project, the key can be seen by visitors. For a public production app, put API requests behind your own backend/serverless function.

TMDB attribution is required by TMDB's terms. The app includes a basic footer attribution; for a public release, follow TMDB's current attribution/logo requirements.
