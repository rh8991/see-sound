# לראות את הקול (See-Sound)

An interactive web laboratory for exploring sound frequencies, built for educational use at Technoda Hadera (טכנודע חדרה). Hebrew RTL interface throughout.

**Live site**: <https://rh8991.github.io/see-sound/> — intro page at [`intro.html`](https://rh8991.github.io/see-sound/intro.html), lab at [`index.html`](https://rh8991.github.io/see-sound/index.html).

**Instructor lesson-plan brief**: [`new_guid.md`](new_guid.md) (Hebrew) — hand it to Claude together with the existing lesson plan (מערך) to bring the plan in line with the current activity.

## Features

- **Intro Page**: "מה זה בעצם גל קול?" (`intro.html`) — projector-friendly explainer (particles, compression/rarefaction, frequency vs. amplitude) with a live microphone oscilloscope (time / frequency views, pure 440 Hz tone, freeze, fullscreen) and a QR code that opens the lab
- **Interactive Frequency Lab**: Choose from preset musical notes or enter a custom frequency (20 Hz – 20,000 Hz)
- **Waveform Visualization**: Real-time canvas rendering of time-domain audio data with pause/freeze capability
- **Octave Navigation**: Step through octaves (◀ ▶) on the musical notes tab (C2 – C7)
- **Superposition**: Add several frequencies (the + button next to each note, or "⊕ הוסף לסופרפוזיציה") and see the combined waveform
- **Volume Control**: 0–100% slider; louder = taller wave
- **Song Player**: "שירים" button plays simple songs note by note while drawing each note's waveform
- **Bluetooth Tab**: Scan for and connect to nearby Bluetooth devices via the Web Bluetooth API
- **Simon Game**: Memory game (`simon.html`) — repeat a growing sequence of musical notes while watching each note's waveform; shared top-10 leaderboard (Firebase Firestore)
- **Spectrometer**: Live microphone analysis (`spectrum.html`) — sing or play a note and watch its frequency spectrum, fundamental, harmonics, and tuning in real time
- **Guided Tours**: 9-step tour on the lab, 6-step tours on the spectrometer and Simon
- **Manager Panel**: Password-protected admin page to add, edit, and delete frequency samples and categories
- **Hebrew & RTL Support**: Full right-to-left interface
- **Responsive Design**: Works on desktop and mobile
- **GitHub Pages Compatible**: Runs entirely in the browser with localStorage

## Project Structure

```text
see-sound/
├── .github/workflows/
│   └── jekyll-gh-pages.yml   # Deploys docs/ to GitHub Pages on push to main
├── package.json              # Node.js dependencies (optional local dev)
├── server.js                 # Express server (optional local dev with persistence)
├── new_guid.md               # Lesson-plan update brief for instructors (Hebrew)
├── docs/                     # GitHub Pages root (served to browser)
│   ├── intro.html            # "What is a sound wave?" intro + live mic oscilloscope
│   ├── index.html            # Main student interface (lab)
│   ├── simon.html            # Simon memory game
│   ├── spectrum.html         # Live microphone spectrometer
│   ├── manager.html          # Manager / admin panel
│   ├── css/
│   │   └── style.css         # Stylesheet with RTL support
│   ├── data/
│   │   ├── frequencies.json  # Default frequency data
│   │   └── songs.json        # Songs for the song player
│   ├── assets/
│   │   └── images/
│   └── js/
│       ├── audio-engine.js   # Web Audio API — tone generation, superposition, waveform visualization
│       ├── song-player.js    # Song player (plays songs.json note by note)
│       ├── bluetooth-engine.js  # Web Bluetooth API — device scan and connect
│       ├── api.js            # Data abstraction (localStorage / Express)
│       ├── app.js            # Main student app logic
│       ├── simon.js          # Simon game logic + leaderboard
│       ├── firebase-config.js   # Firebase config for the Simon leaderboard
│       ├── spectrum.js       # Spectrometer — mic capture, FFT display, pitch detection
│       └── manager.js        # Manager panel logic
└── README.md
```

## Pages

### Intro Page (`intro.html`)

Opening explainer for the projector, framed as "receiving a mysterious transmission from space". Not linked from the lab — open it directly.

1. A wave moves energy, not matter (animated particles)
2. Sound is a compression wave (compression / rarefaction)
3. The two properties we measure: frequency and amplitude
4. Live microphone oscilloscope — **〰️ זמן** (time) and **📊 תדר** (frequency) views, **🔔 צליל טהור** (pure 440 Hz sine for comparison, works without a mic), freeze, gain, time span, fullscreen. Keys: Space freeze · T time · F frequency · Enter / double-click fullscreen · Esc exit

Ends with a QR code (click to enlarge) that opens the lab.

### Main Interface (`index.html`)

The student lab. Two-column layout: waveform canvas on the left, controls on the right.

**Right panel tabs:**

| Tab | What it does |
| --- | ------------ |
| **תווים** (Notes) | Preset musical notes (C D E F G A B) with octave navigation; Special Frequencies sub-category |
| **התאמה** (Custom) | Frequency slider + number input, 20–20,000 Hz |
| **בלוטוס** (Bluetooth) | Scan for and connect to Bluetooth devices |

**Superposition panel (⊕ סופרפוזיציה):** add frequencies with the + next to each note or "⊕ הוסף לסופרפוזיציה" on the Custom tab; each appears as a colored chip (× removes, 🗑️ clears all) and the combined wave is drawn. Playing a single note clears the superposition.

**Volume slider:** 0–100% (default 30%).

**Control buttons:**

- **▶️ השמע** — Play the selected frequency
- **⏸️ השהה** — Pause audio and freeze the waveform
- **🗑️ נקה** — Stop everything (including superposition) and clear the canvas

**Floating buttons:** **ספקטרומטר**, **סיימון**, and **שירים** (song player modal; songs come from `docs/data/songs.json` and play with a now-playing bar ⏸️ / ⏹️).

The ℹ button opens a 9-step guided tour. The footer links to the Manager panel.

### Simon Game (`simon.html`)

A Hebrew Simon Says memory game using the 7 musical notes (C D E F G A B). The game plays a growing sequence; each note lights up its color-coded button and shows its live waveform on the canvas. Players must repeat the sequence in order.

- Tracks current round, best score (localStorage), and step progress
- **↺ שמע שוב** — replay the current sequence
- **🏆 Leaderboard** — after a mistake, players can enter a name (max 20 chars) and save their score; the leaderboard shows the top 10. Scores are stored in Firebase Firestore (collection `simon-scores`, configured in `docs/js/firebase-config.js`) and shared across all devices. Without internet / Firebase the save option is hidden and the game still works
- ℹ opens a 6-step guided tour; back link returns to `index.html`

### Spectrometer (`spectrum.html`)

Live frequency-domain analysis of the microphone input — the counterpart to the time-domain waveform on the main page. Reached from the ספקטרומטר FAB on `index.html`.

- Log-scale FFT spectrum (8192-point) drawn on canvas, with frequency grid, octave (דו) markers, and an optional peak-hold envelope
- Fundamental detected with normalized autocorrelation (octave-error resistant, works even when the fundamental is weak) and marked in red on the graph
- Big note readout (Hebrew + scientific pitch, e.g. `לה` / `A4`) with a cents tuner bar and an input-level meter
- Settings: display range (1k / 2k / 5k / 20k Hz), sensitivity, peak hold, note markers
- **❄️ הקפא** freezes the display; the mic is released automatically when the page is hidden
- ℹ opens a 6-step guided tour; back link returns to `index.html`

Requires microphone permission and a secure context (`https://` or `localhost`); Hebrew error messages cover denied permission, no device, busy device, and insecure origin.

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
3. Under "Source", select **GitHub Actions** (the included workflow deploys `docs/`)
4. Push to `main`

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
- Intro page: `http://localhost:3000/intro.html`
- Simon game: `http://localhost:3000/simon.html`
- Spectrometer: `http://localhost:3000/spectrum.html`
- Manager panel: `http://localhost:3000/manager.html`

The Express backend (`server.js`) is optional. The app works fully with just localStorage.

## Default Frequency Samples

Defaults live in `docs/data/frequencies.json`.

### Musical Notes (תווים מוזיקליים)

Seven notes per octave, from דו C2 (65.41 Hz) to דו C7 (2093 Hz). Octave 4 for reference:

- דו (C4) — 261.63 Hz
- רה (D4) — 293.66 Hz
- מי (E4) — 329.63 Hz
- פה (F4) — 349.23 Hz
- סול (G4) — 392 Hz
- לה (A4) — 440 Hz
- סי (B4) — 493.88 Hz

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

The workflow `.github/workflows/jekyll-gh-pages.yml` uploads the `docs/` folder and deploys it to GitHub Pages on every push to `main` (or manually via *Run workflow*).

1. Fork this repo
2. Settings → Pages → Source: **GitHub Actions**
3. Push to `main` — the app goes live at `https://YOUR-USERNAME.github.io/see-sound/`

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
