# לראות את הקול (See-Sound)

An interactive web laboratory for exploring sound frequencies, built for educational use at Technoda Hadera (טכנודע חדרה). Hebrew RTL interface throughout.

**Live Demo**: Deploy to GitHub Pages — see [GitHub Pages Deployment](#github-pages-deployment) below.

## Features

- **Interactive Frequency Lab**: Choose from preset musical notes or enter a custom frequency (20 Hz – 20,000 Hz)
- **Waveform Visualization**: Real-time canvas rendering of time-domain audio data with pause/freeze capability
- **Octave Navigation**: Step through octaves (◀ ▶) on the musical notes tab
- **Bluetooth Tab**: Scan for and connect to nearby Bluetooth devices via the Web Bluetooth API
- **Simon Game**: Memory game (`simon.html`) — repeat a growing sequence of musical notes while watching each note's waveform
- **Guided Tour**: 9-step intro modal explaining waves, controls, and all tabs
- **Manager Panel**: Password-protected admin page to add, edit, and delete frequency samples and categories
- **Hebrew & RTL Support**: Full right-to-left interface
- **Responsive Design**: Works on desktop and mobile
- **GitHub Pages Compatible**: Runs entirely in the browser with localStorage

## Project Structure

```text
see-sound/
├── package.json              # Node.js dependencies (optional local dev)
├── server.js                 # Express server (optional local dev with persistence)
├── data/
│   └── frequencies.json      # Default frequency data
├── docs/                     # GitHub Pages root (served to browser)
│   ├── index.html            # Main student interface
│   ├── simon.html            # Simon memory game
│   ├── manager.html          # Manager / admin panel
│   ├── css/
│   │   └── style.css         # Stylesheet with RTL support
│   ├── assets/
│   │   └── images/
│   └── js/
│       ├── audio-engine.js   # Web Audio API — tone generation and waveform visualization
│       ├── bluetooth-engine.js  # Web Bluetooth API — device scan and connect
│       ├── api.js            # Data abstraction (localStorage / Express)
│       ├── app.js            # Main student app logic
│       ├── simon.js          # Simon game logic
│       └── manager.js        # Manager panel logic
└── README.md
```

## Pages

### Main Interface (`index.html`)

The student lab. Two-column layout: waveform canvas on the left, controls on the right.

**Right panel tabs:**

| Tab | What it does |
| --- | ------------ |
| **תווים** (Notes) | Preset musical notes (C D E F G A B) with octave navigation; Special Frequencies sub-category |
| **התאמה** (Custom) | Frequency slider + number input, 20–20,000 Hz |
| **בלוטוס** (Bluetooth) | Scan for and connect to Bluetooth devices |

**Control buttons:**

- **▶️ השמע** — Play the selected frequency
- **⏸️ השהה** — Pause audio and freeze the waveform
- **🗑️ נקה** — Clear the canvas

The ℹ button opens a 9-step guided tour.

Footer links to the Simon game and the Manager panel.

### Simon Game (`simon.html`)

A Hebrew Simon Says memory game using the 7 musical notes (C D E F G A B). The game plays a growing sequence; each note lights up its color-coded button and shows its live waveform on the canvas. Players must repeat the sequence in order.

- Tracks current round, best score (localStorage), and step progress
- **↺ שמע שוב** — replay the current sequence
- Back link returns to `index.html`

### Manager Panel (`manager.html`)

Password-protected admin interface.

1. Navigate to `/manager.html`
2. Enter the password: **`admin123`** (change for production — see [Security](#security))
3. Add, edit, or delete frequency samples
4. Edit category display names

## Installation & Usage

### Option 1: GitHub Pages (No Installation Needed)

1. Fork the repository on GitHub
2. Go to **Settings → Pages**
3. Under "Source", select **main** branch and **/docs** folder
4. Click "Save"

Your app will be live at `https://YOUR-USERNAME.github.io/see-sound/`

No backend needed — everything runs in the browser with localStorage.

### Option 2: Local Development

```bash
cd see-sound
npm install
npm start
```

Server starts on `http://localhost:3000`.

- Student interface: `http://localhost:3000`
- Simon game: `http://localhost:3000/simon.html`
- Manager panel: `http://localhost:3000/manager.html`

The Express backend (`server.js`) is optional. The app works fully with just localStorage.

## Default Frequency Samples

### Musical Notes (תווים מוזיקליים)

- דו (C4) — 262 Hz
- רה (D4) — 294 Hz
- מי (E4) — 330 Hz
- פה (F4) — 349 Hz
- סול (G4) — 392 Hz
- לה (A4) — 440 Hz
- סי (B4) — 494 Hz

### Special Frequencies (תדרים מיוחדים)

- משפחה נמוכה (Low): 50 Hz
- משפחה בינונית (Mid): 500 Hz
- משפחה גבוהה (High): 2000 Hz

## Security

- **Default password**: `admin123`
  - Change it in `docs/js/api.js` (the `if (password !== 'admin123')` check)
  - On GitHub Pages the password is visible in client-side code — use only for educational purposes
- **Express backend**: Change password in `server.js` line 30 (`const MANAGER_PASSWORD`)
- **Data**: Stored in browser localStorage. Clearing browser data resets to defaults.

## Technical Details

### Architecture

The `api.js` abstraction layer operates in two modes:

1. **GitHub Pages / static mode** (default): uses `localStorage`; no backend; each browser has its own data
2. **Express mode** (optional): falls back to Express API when `server.js` is running; syncs `data/frequencies.json`; multiple users share data

### Audio

- Web Audio API — `OscillatorNode` (sine wave) → `GainNode` → `AnalyserNode` → speakers
- 2048-sample FFT window for time-domain waveform data

### Visualization

- HTML5 Canvas, real-time time-domain drawing
- Grid overlay for reference
- Freeze/pause captures the last waveform state
- Simon game uses per-note color theming on the same canvas

### Bluetooth

- `BluetoothEngine` class wraps the Web Bluetooth API
- `scanDevices()` calls `navigator.bluetooth.requestDevice()` with `acceptAllDevices: true`
- `connectDevice()` connects to the GATT server and listens for disconnection events
- Requires HTTPS or localhost; not available in all browsers

## Browser Support

- **Chrome / Edge 14+** — Audio ✅, Bluetooth ✅ (HTTPS required)
- **Firefox 7+** — Audio ✅, Bluetooth ❌
- **Safari 6+** — Audio ✅, Bluetooth ❌
- **iOS Safari / Chrome Mobile** — Audio ✅, Bluetooth partial

## Customization

### Adding Frequencies

**Via Manager Panel (easiest):**

1. Go to `/manager.html`, log in
2. Click "הוסף תדר חדש", fill in details

**Via code — edit defaults in `docs/js/api.js`:**

```javascript
const defaultFrequencies = {
  samples: [
    { id: 11, name: "My Frequency", frequency: 1000, category: "custom" },
  ],
  categoryNames: { "custom": "My Category" }
};
```

### Resetting to Defaults

Open DevTools → Application → Local Storage → delete `frequencies-data` → refresh.

### Changing Colors

Edit `docs/css/style.css`:

- Primary: `#667eea` (purple)
- Secondary: `#764ba2` (dark purple)

## Troubleshooting

**No sound?** — Check browser audio permissions; click the page once before playing (browsers require a user gesture); check volume.

**Waveform not showing?** — Audio must be playing; verify Canvas support.

**Can't log into Manager?** — Password is `admin123`, case-sensitive.

**Data lost?** — localStorage doesn't persist in private/incognito mode.

**Bluetooth not working?** — Requires HTTPS (or localhost) and a Chrome/Edge browser.

## GitHub Pages Deployment

1. Fork this repo
2. Settings → Pages → Source: **main** branch, **/docs** folder → Save
3. App goes live at `https://YOUR-USERNAME.github.io/see-sound/`

Changes pushed to main deploy automatically within a few minutes.

## Learning Concepts

- **Frequency & Pitch**: Hz ↔ perceived pitch
- **Human Hearing Range**: 20 Hz – 20,000 Hz
- **Waveforms**: Visual representation of oscillating sound
- **Amplitude**: Volume ↔ wave height
- **Musical Notes**: Standard pitch frequencies and octaves
- **Memory & Pattern Recognition**: Simon game

## License

MIT License — free to use and modify.

## Author

Created for educational use at **Technoda Hadera (טכנודע חדרה)**, teaching frequency and sound concepts interactively.

---

© 2026 לראות את הקול — טכנודע חדרה
