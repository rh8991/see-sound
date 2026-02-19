# 🎵 שמוע-צליל (See-Sound)

An interactive web application for learning about sound frequencies with Hebrew RTL support.

**Live Demo**: [Deploy to GitHub Pages](#github-pages-deployment)

## Features

- 🎵 **Interactive Frequency Listening**: Choose from preset frequencies or create custom ones
- 📊 **Waveform Visualization**: Real-time visualization of sine wave patterns with freeze capability
- 🎚️ **Frequency Slider**: Fine-tune frequencies from 20Hz to 20,000Hz
- 🔊 **Volume Control**: Adjustable volume slider
- 🔐 **Manager Panel**: Password-protected admin interface to manage frequency samples
- 🇮🇱 **Hebrew & RTL Support**: Full Right-to-Left interface support
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🌐 **GitHub Pages Compatible**: Runs entirely in the browser with localStorage

## Project Structure

```see-sound/
├── package.json                 # Node.js dependencies (optional - for local dev)
├── server.js                    # Express server (optional - for local dev with persistence)
├── public/                      # All files served to browser (GitHub Pages root)
│   ├── index.html              # Student interface (main page)
│   ├── manager.html            # Manager/admin panel
│   ├── css/
│   │   └── style.css           # Main stylesheet with RTL support
│   └── js/
│       ├── api.js              # API abstraction layer (localStorage/Express)
│       ├── audio-engine.js     # Audio generation and visualization
│       ├── app.js              # Main student app logic
│       └── manager.js          # Manager panel logic
└── README.md                    # This file
```

## Installation & Usage

### Option 1: GitHub Pages (No Installation Needed! 🎉)

Simply fork/clone the repository and deploy to GitHub Pages:

1. **Fork the repository** on GitHub
2. Go to **Settings → Pages**
3. Under "Source", select **Deploy from a branch**
4. Choose **main** branch and **/root** folder (or `/public` if you have it set up)
5. Your app is now live at: `https://YOUR-USERNAME.github.io/see-sound/`

**No backend needed!** Everything runs in your browser with localStorage.

### Option 2: Local Development with Node.js Server

For local testing with optional Express backend:

1. **Clone or download the project**

   ```bash
   cd see-sound
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   ```

The server will start on `http://localhost:3000`

- **Student Interface**: `http://localhost:3000` (or `http://localhost:3000/index.html`)
- **Manager Panel**: `http://localhost:3000/manager.html`

**Note**: The Express backend (server.js) is optional. The app works perfectly with just localStorage (like on GitHub Pages).

### Student Interface

1. **Select from Presets**: Click any frequency button to play it
2. **Custom Frequency**: Use the slider or input field to select any frequency
3. **Volume Control**: Adjust the volume slider (0-100%)
4. **Play/Stop**: Use the play and stop buttons to control audio
5. **Freeze Waveform**: Click "Stop" to freeze the visualization for explanation
6. **Clear**: Click "Clear" to remove the frozen waveform

### Manager Panel

1. Navigate to `/manager.html`
2. Enter the password: **`admin123`** (change this for production!)
3. **Manage Frequency Samples**:
   - View all current frequency samples
   - Edit existing frequencies (names and values)
   - Delete frequencies
   - Add new frequencies

4. **Manage Categories**:
   - Edit category names displayed in the student interface
   - Current categories: "תווים מוזיקליים" (Musical Notes) and "תדרים מיוחדים" (Special Frequencies)

### Data Storage

- **On GitHub Pages**: Data is stored in browser's localStorage (persists between sessions)
- **With Express Backend**: Optionally syncs with server database for persistence

Each user has their own localStorage, so changes made in one browser don't affect others.

## Default Frequency Samples

### Musical Notes (תווים מוזיקליים)

- סול (G): 392 Hz
- דו (C): 262 Hz
- רה (D): 294 Hz
- מי (E): 330 Hz
- פה (F): 349 Hz
- לה (A): 440 Hz
- סי (B): 494 Hz

### Special Frequencies (תדרים מיוחדים)

- משפחה נמוכה (Low): 50 Hz
- משפחה בינונית (Mid): 500 Hz
- משפחה גבוהה (High): 2000 Hz

## Security

⚠️ **Important Security Notes**:

1. **Password**: The default manager password is `admin123`
   - Change it by editing the `API.init()` method in `public/js/api.js` (look for the password check: `if (password !== 'admin123')`)
   - **On GitHub Pages**: The password is visible in client-side code (this is unavoidable with static hosting)
   - **Use only for educational purposes** - don't store sensitive passwords!

2. **Data Privacy**:
   - Data is stored in browser's localStorage (not sent to any server unless you use the Express backend)
   - Each browser/device has separate data
   - Clearing browser data will reset to default frequencies

3. **If using Express Backend**:
   - Change the password in `server.js` line 30: `const MANAGER_PASSWORD = 'admin123';`
   - Consider adding authentication tokens for production use
   - Secure your server with HTTPS

## Technical Details

### Architecture

The app uses an **API abstraction layer** that works in two modes:

1. **GitHub Pages Mode** (Default):
   - Uses browser's `localStorage` API
   - No backend server needed
   - Changes persist in the browser
   - Each browser has its own data

2. **Express Backend Mode** (Optional):
   - Falls back to Express API if available
   - Attempts to sync localStorage with server
   - Server persists data in `data/frequencies.json`
   - Multiple users can share data

The `api.js` file handles both modes seamlessly.

### Audio Generation

- Uses Web Audio API for real-time frequency generation
- Sine wave oscillator for pure tone generation
- Gain node for volume control
- Analyser node for frequency/time-domain data

### Visualization

- HTML5 Canvas for waveform rendering
- Real-time drawing of time-domain audio data
- Shows amplitude over time in 2048-sample windows
- Freeze capability for explanation/teaching
- Grid overlay for reference

## Browser Support

- Chrome/Edge 14+
- Firefox 7+
- Safari 6+
- Mobile browsers (iOS Safari, Chrome Mobile)

Note: Requires Web Audio API support

## Learning Concepts

Students can explore:

- **Frequency & Pitch**: How Hz relates to how we perceive sound
- **Human Hearing Range**: 20Hz - 20,000Hz
- **Waveforms**: Visual representation of oscillating sound
- **Musical Notes**: Standard pitch frequencies
- **Frequency Characteristics**: Different frequency ranges and their properties

## Customization

### Adding New Default Frequencies

**Option 1: Use the Manager Panel** (Easiest)

1. Go to `/manager.html`
2. Login with password: `admin123`
3. Click "הוסף תדר חדש" (Add New Frequency)
4. Fill in the details and submit

**Option 2: Edit `api.js` for Defaults**
Edit `public/js/api.js` - in the `API.init()` method, modify the `defaultFrequencies` object:

```javascript
const defaultFrequencies = {
  samples: [
    { id: 11, name: "My Frequency", frequency: 1000, category: "custom" },
    // ... more frequencies
  ],
  categoryNames: {
    "custom": "My Category"
  }
};
```

### Resetting to Defaults

To reset all frequencies to defaults:

1. Open browser Developer Tools (F12)
2. Go to Application → Local Storage
3. Find `frequencies-data` and delete it
4. Refresh the page

### Changing UI Colors

Edit `public/css/style.css`:

- Primary color: `#667eea` (purple)
- Secondary color: `#764ba2` (dark purple)
- Accent colors available for customization

## Troubleshooting

### No Sound Playing?

- Check browser audio permissions
- Try clicking the page first (some browsers require user interaction)
- Check browser console for errors (F12)
- Ensure your device volume is not muted

### Waveform Not Showing?

- The waveform appears when audio is playing
- Try playing a frequency first
- Check if Canvas is supported in your browser

### Can't Log into Manager?

- Default password is `admin123`
- Password is case-sensitive

### Data Lost After Closing Browser?

This shouldn't happen - localStorage persists data. But if it does:

- Check if localStorage is enabled in your browser settings
- Try a different browser
- Check if you're in private/incognito mode (data doesn't persist there)

## GitHub Pages Deployment

### Easy Setup (5 minutes)

1. **Fork this repository** on GitHub
2. Open your forked repository
3. Go to **Settings → Pages**
4. Under "Source", select **main** branch
5. Select **/public** folder
6. Click "Save"
7. GitHub will deploy and show you the URL

Your app will be live at: `https://YOUR-USERNAME.github.io/see-sound/`

### Custom Domain

To use a custom domain:

1. Go to **Settings → Pages**
2. Under "Custom domain", enter your domain
3. GitHub will show DNS configuration steps
4. Update your domain's DNS records
5. GitHub will handle the SSL certificate automatically

### Automatic Deployment

Changes pushed to the main branch automatically deploy within a few minutes!

## Environment Info

The app automatically detects its environment:

- **GitHub Pages**: Uses localStorage (no server)
- **Local with Express**: Falls back to Express API if server.js is running
- **Other Static Hosts**: Uses localStorage (Netlify, Vercel, etc.)

## Future Enhancements

Potential features:

- Multiple waveform types (square, sawtooth, triangle)
- Frequency sweep visualization
- Beat frequency demonstration
- Sound recording and playback
- Frequency analysis tool
- Temperature/humidity adjustments
- Multiuser sessions

## License

MIT License - Feel free to use and modify

## Author

Created for educational purposes to teach frequency and sound concepts in an interactive way.

---

## Enjoy exploring sound frequencies! 🎵
