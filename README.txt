
PocketPilot Finance (v1) - PWA Package
-------------------------------------

Files included:
- index.html
- styles.css
- app.js
- manifest.json
- sw.js
- README.txt

Quick start (local test):
1. Unzip the package.
2. Serve it via a local static server (recommended) or host on GitHub Pages:
   - Recommended quick: use `npx http-server` or `python3 -m http.server 8000` in the folder, then visit http://localhost:8000
   - IMPORTANT: iPhone Add to Home Screen requires HTTPS to behave like a PWA when hosted publicly. GitHub Pages provides HTTPS automatically.
3. Obtain a free Alpha Vantage API key (https://www.alphavantage.co/support/#api-key) and paste it into Settings -> Alpha Vantage API Key in the app.
4. Add investments (stocks and/or crypto). Click 'Refresh Market Data' to fetch quotes and see Trend Tracker suggestions.
5. To install on iPhone: Open the hosted link in Safari -> Tap Share -> Add to Home Screen -> Add.

Notes & Limitations:
- Stock data uses Alpha Vantage (free tier). Rate limits apply (~5 requests/minute). This app requests per-symbol data; keep watchlist small for best results.
- Crypto data uses CoinGecko (no key) and has generous free limits.
- All user financial entries are stored locally in your browser's localStorage. No server backend included; the app is private to your device.
- Trend tracker currently uses 7-day momentum as a simple heuristic. It is NOT financial advice.

If you'd like, I can:
- Host this on GitHub Pages for you and provide a one-tap HTTPS link.
- Add nicer icons and polish UI further.
- Add an optional encrypted cloud sync for your own account (requires server).
