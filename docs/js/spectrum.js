// Spectrometer - live microphone input, frequency-domain (FFT) visualization
// and musical note detection.

const NOTE_NAMES_HE = ['דו', 'דו#', 'רה', 'רה#', 'מי', 'פה', 'פה#', 'סול', 'סול#', 'לה', 'לה#', 'סי'];
const NOTE_NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MIN_DISPLAY_FREQ = 30;    // Hz - left edge of the graph
const MIN_DETECT_FREQ  = 60;    // Hz - lowest note we try to detect
const MAX_DETECT_FREQ  = 2000;  // Hz - highest note we try to detect
const DETECT_INTERVAL  = 90;    // ms between pitch detections
const ACF_WINDOW       = 2048;  // samples used for autocorrelation

// ── Microphone engine ─────────────────────────────────────────────────────

class MicEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.isRunning = false;
    this.freqData = null;   // Float32Array, dB per bin
    this.timeData = null;   // Float32Array, -1..1 samples
  }

  // Ask for microphone access and wire up the analyser
  async start() {
    if (!window.isSecureContext) {
      throw new Error('insecure');
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('unsupported');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Keep the raw signal - these filters distort the spectrum
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 8192;             // ~5.9 Hz resolution at 48 kHz
    this.analyser.smoothingTimeConstant = 0.7;
    this.analyser.minDecibels = -95;
    this.analyser.maxDecibels = -20;

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    // Note: the analyser is intentionally NOT connected to the destination,
    // otherwise the microphone would be played back and cause feedback.

    this.freqData = new Float32Array(this.analyser.frequencyBinCount);
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.isRunning = true;
  }

  // Release the microphone
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
    this.isRunning = false;
  }

  get sampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 48000;
  }

  // Lower minDecibels = more sensitive (weak sounds still fill the graph)
  setSensitivity(percent) {
    if (!this.analyser) return;
    const clamped = Math.max(0, Math.min(100, percent));
    this.analyser.minDecibels = -60 - (clamped / 100) * 50; // -60 .. -110 dB
  }

  updateData() {
    if (!this.analyser) return false;
    this.analyser.getFloatFrequencyData(this.freqData);
    this.analyser.getFloatTimeDomainData(this.timeData);
    return true;
  }
}

// ── Pitch detection (normalized autocorrelation) ──────────────────────────

// Returns { freq, clarity, rms }. freq is -1 when no clear pitch was found.
function detectPitch(buffer, sampleRate) {
  const n = Math.min(ACF_WINDOW, buffer.length);

  // Signal strength gate - ignore silence / room noise
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return { freq: -1, clarity: 0, rms };

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_DETECT_FREQ));
  const maxLag = Math.min(Math.floor(sampleRate / MIN_DETECT_FREQ), Math.floor(n / 2));
  if (maxLag <= minLag) return { freq: -1, clarity: 0, rms };

  const windowLen = n - maxLag; // samples compared for every lag

  // Prefix sums of squares, so each lag can be normalized by its own energy
  const prefix = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + buffer[i] * buffer[i];
  const energy0 = prefix[windowLen];
  if (energy0 <= 0) return { freq: -1, clarity: 0, rms };

  const corr = new Float32Array(maxLag + 1);
  let bestValue = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let j = 0; j < windowLen; j++) sum += buffer[j] * buffer[j + lag];
    const energyLag = prefix[lag + windowLen] - prefix[lag];
    const denom = Math.sqrt(energy0 * energyLag);
    const value = denom > 0 ? sum / denom : 0;
    corr[lag] = value;
    if (value > bestValue) bestValue = value;
  }

  if (bestValue < 0.3) return { freq: -1, clarity: bestValue, rms };

  // Pick the SMALLEST lag that is nearly as good as the best one. The
  // autocorrelation also peaks at multiples of the true period, so taking the
  // global maximum would often report an octave too low.
  const threshold = bestValue * 0.9;
  let chosenLag = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] >= threshold && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      chosenLag = lag;
      break;
    }
  }
  if (chosenLag < 0) return { freq: -1, clarity: bestValue, rms };

  // Parabolic interpolation around the peak for sub-sample accuracy
  const y1 = corr[chosenLag - 1];
  const y2 = corr[chosenLag];
  const y3 = corr[chosenLag + 1];
  const denom = 2 * (2 * y2 - y1 - y3);
  const refinedLag = denom !== 0 ? chosenLag + (y3 - y1) / denom : chosenLag;

  return { freq: sampleRate / refinedLag, clarity: y2, rms };
}

// Convert a frequency to the nearest tempered note (A4 = 440 Hz)
function frequencyToNote(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const nearest = Math.round(midi);
  return {
    index: ((nearest % 12) + 12) % 12,
    octave: Math.floor(nearest / 12) - 1,
    cents: Math.round((midi - nearest) * 100),
  };
}

// ── Spectrum visualizer ───────────────────────────────────────────────────

class SpectrumVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.axisHeight = 26;      // reserved strip for the frequency labels
    this.maxFreq = 2000;
    this.showNoteMarkers = true;
    this.peakHold = false;
    this.peaks = null;         // per-column decaying maximum

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.peaks = new Float32Array(Math.max(1, Math.ceil(rect.width)));
  }

  setMaxFreq(freq) {
    this.maxFreq = freq;
    this.resetPeaks();
  }

  resetPeaks() {
    if (this.peaks) this.peaks.fill(0);
  }

  get plotHeight() {
    return Math.max(10, this.height - this.axisHeight);
  }

  // Logarithmic frequency axis: equal screen distance per octave
  freqToX(freq) {
    const clamped = Math.max(MIN_DISPLAY_FREQ, Math.min(this.maxFreq, freq));
    const ratio =
      Math.log(clamped / MIN_DISPLAY_FREQ) / Math.log(this.maxFreq / MIN_DISPLAY_FREQ);
    return ratio * this.width;
  }

  xToFreq(x) {
    const ratio = x / this.width;
    return MIN_DISPLAY_FREQ * Math.pow(this.maxFreq / MIN_DISPLAY_FREQ, ratio);
  }

  clear(message) {
    const { ctx } = this;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid();
    if (message) {
      ctx.font = '600 15px "Segoe UI", Tahoma, sans-serif';
      ctx.fillStyle = 'rgba(118, 75, 162, 0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(message, this.width / 2, this.plotHeight / 2);
    }
  }

  drawGrid() {
    const { ctx } = this;
    const plotH = this.plotHeight;
    const ticks = [30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000];

    // Horizontal amplitude guides
    ctx.strokeStyle = '#eeeeee';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Vertical frequency guides + labels
    ctx.font = '11px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let lastLabelX = -100;
    ticks.forEach((freq) => {
      if (freq < MIN_DISPLAY_FREQ || freq > this.maxFreq) return;
      const x = this.freqToX(freq);
      ctx.strokeStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotH);
      ctx.stroke();

      if (x - lastLabelX < 42) return; // avoid crowded labels on phones
      lastLabelX = x;
      ctx.fillStyle = '#999';
      const label = freq >= 1000 ? `${freq / 1000}k` : String(freq);
      ctx.fillText(label, Math.min(this.width - 12, Math.max(12, x)), plotH + 5);
    });

    // Axis baseline
    ctx.strokeStyle = '#764ba2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, plotH);
    ctx.lineTo(this.width, plotH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#999';
    ctx.font = '11px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText('Hz', 2, plotH + 5);
  }

  // Light vertical marks at every C, so the octaves are easy to spot
  drawNoteMarkers() {
    if (!this.showNoteMarkers) return;
    const { ctx } = this;
    const plotH = this.plotHeight;
    ctx.font = '10px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let octave = 1; octave <= 8; octave++) {
      const freq = 440 * Math.pow(2, (12 * (octave + 1) - 69) / 12); // C of this octave
      if (freq < MIN_DISPLAY_FREQ || freq > this.maxFreq) continue;
      const x = this.freqToX(freq);
      ctx.strokeStyle = 'rgba(102, 126, 234, 0.22)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(102, 126, 234, 0.75)';
      ctx.fillText(`דו${octave}`, x, 4);
    }
  }

  // freqData: Float32Array of dB values, one per FFT bin
  draw(freqData, sampleRate, fftSize, minDb, maxDb, fundamental) {
    const { ctx } = this;
    const plotH = this.plotHeight;
    const binHz = sampleRate / fftSize;
    const columns = Math.ceil(this.width);
    const range = Math.max(1, maxDb - minDb);

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid();
    this.drawNoteMarkers();

    // One column per pixel: take the strongest bin that falls into it
    const heights = new Float32Array(columns);
    for (let x = 0; x < columns; x++) {
      const fLow = this.xToFreq(x);
      const fHigh = this.xToFreq(x + 1);
      let binStart = Math.floor(fLow / binHz);
      let binEnd = Math.ceil(fHigh / binHz);
      if (binEnd <= binStart) binEnd = binStart + 1;
      binStart = Math.max(0, binStart);
      binEnd = Math.min(freqData.length - 1, binEnd);

      let peakDb = -Infinity;
      for (let b = binStart; b <= binEnd; b++) {
        if (freqData[b] > peakDb) peakDb = freqData[b];
      }
      const norm = Math.max(0, Math.min(1, (peakDb - minDb) / range));
      heights[x] = norm;

      if (this.peakHold && this.peaks) {
        this.peaks[x] = Math.max(norm, this.peaks[x] * 0.995);
      }
    }

    // Filled spectrum area
    const gradient = ctx.createLinearGradient(0, 0, 0, plotH);
    gradient.addColorStop(0, 'rgba(240, 147, 251, 0.85)');
    gradient.addColorStop(0.5, 'rgba(118, 75, 162, 0.75)');
    gradient.addColorStop(1, 'rgba(102, 126, 234, 0.35)');

    ctx.beginPath();
    ctx.moveTo(0, plotH);
    for (let x = 0; x < columns; x++) {
      ctx.lineTo(x, plotH - heights[x] * plotH);
    }
    ctx.lineTo(columns - 1, plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x < columns; x++) {
      const y = plotH - heights[x] * plotH;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#5568d3';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Peak-hold envelope
    if (this.peakHold && this.peaks) {
      ctx.beginPath();
      for (let x = 0; x < columns; x++) {
        const y = plotH - this.peaks[x] * plotH;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(230, 126, 34, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Fundamental frequency marker
    if (fundamental && fundamental >= MIN_DISPLAY_FREQ && fundamental <= this.maxFreq) {
      const x = this.freqToX(fundamental);
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotH);
      ctx.stroke();

      const label = `${Math.round(fundamental)} Hz`;
      ctx.font = 'bold 12px "Segoe UI", Tahoma, sans-serif';
      const textWidth = ctx.measureText(label).width + 10;
      const boxX = Math.min(this.width - textWidth - 2, Math.max(2, x + 4));
      ctx.fillStyle = 'rgba(231, 76, 60, 0.92)';
      ctx.fillRect(boxX, 4, textWidth, 20);
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + textWidth / 2, 15);
    }
  }
}

// ── Application ───────────────────────────────────────────────────────────

class SpectrometerApp {
  constructor() {
    this.mic = new MicEngine();
    this.visualizer = new SpectrumVisualizer('spectrumCanvas');
    this.animationId = null;
    this.frozen = false;
    this.lastDetection = 0;
    this.smoothedFreq = 0;
    this.currentFreq = -1;
    this.lastValidAt = 0;

    this.el = {
      toggleBtn: document.getElementById('micToggleBtn'),
      freezeBtn: document.getElementById('freezeBtn'),
      statusDot: document.getElementById('micStatusDot'),
      statusText: document.getElementById('micStatusText'),
      overlay: document.getElementById('micOverlay'),
      overlayMsg: document.getElementById('micOverlayMsg'),
      error: document.getElementById('micError'),
      noteHe: document.getElementById('noteHeDisplay'),
      noteEn: document.getElementById('noteEnDisplay'),
      cents: document.getElementById('centsDisplay'),
      needle: document.getElementById('tunerNeedle'),
      level: document.getElementById('levelFill'),
      baseFreq: document.getElementById('baseFreqDisplay'),
      peakFreq: document.getElementById('peakFreqDisplay'),
      range: document.getElementById('rangeSelect'),
      sensitivity: document.getElementById('sensitivitySlider'),
      sensitivityDisplay: document.getElementById('sensitivityDisplay'),
      peakHold: document.getElementById('peakHoldToggle'),
      notes: document.getElementById('notesToggle'),
    };

    this.setupEventListeners();
    this.setupModalControls();
    this.visualizer.setMaxFreq(parseInt(this.el.range.value, 10));
    this.visualizer.clear();
  }

  setupEventListeners() {
    this.el.toggleBtn.addEventListener('click', () => {
      if (this.mic.isRunning) this.stopListening();
      else this.startListening();
    });

    this.el.freezeBtn.addEventListener('click', () => this.toggleFreeze());

    this.el.range.addEventListener('change', (e) => {
      this.visualizer.setMaxFreq(parseInt(e.target.value, 10));
      if (!this.mic.isRunning) this.visualizer.clear();
    });

    this.el.sensitivity.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      this.el.sensitivityDisplay.textContent = `${value}%`;
      this.mic.setSensitivity(value);
    });

    this.el.peakHold.addEventListener('change', (e) => {
      this.visualizer.peakHold = e.target.checked;
      this.visualizer.resetPeaks();
    });

    this.el.notes.addEventListener('change', (e) => {
      this.visualizer.showNoteMarkers = e.target.checked;
      if (!this.mic.isRunning) this.visualizer.clear();
    });

    // Release the microphone when the page is hidden (saves battery on mobile)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mic.isRunning) this.stopListening();
    });

    // Redraw the idle grid after the canvas has been resized by the layout
    window.addEventListener('resize', () => {
      if (!this.mic.isRunning) this.visualizer.clear();
    });
  }

  async startListening() {
    this.showError('');
    this.el.toggleBtn.disabled = true;
    this.el.toggleBtn.textContent = '⏳ מבקש הרשאה...';

    try {
      await this.mic.start();
      this.mic.setSensitivity(parseInt(this.el.sensitivity.value, 10));
      this.frozen = false;
      this.el.overlay.classList.add('hidden');
      this.el.toggleBtn.textContent = '⏹️ עצור האזנה';
      this.el.toggleBtn.classList.remove('btn-play');
      this.el.toggleBtn.classList.add('btn-clear');
      this.el.freezeBtn.disabled = false;
      this.el.freezeBtn.textContent = '❄️ הקפא';
      this.setStatus(true, 'מאזין למיקרופון...');
      this.visualizer.resize();
      this.visualizer.resetPeaks();
      this.startLoop();
    } catch (error) {
      this.handleMicError(error);
      this.el.toggleBtn.textContent = '🎤 התחל האזנה';
    } finally {
      this.el.toggleBtn.disabled = false;
    }
  }

  stopListening() {
    this.mic.stop();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.frozen = false;
    this.el.toggleBtn.textContent = '🎤 התחל האזנה';
    this.el.toggleBtn.classList.add('btn-play');
    this.el.toggleBtn.classList.remove('btn-clear');
    this.el.freezeBtn.disabled = true;
    this.el.freezeBtn.textContent = '❄️ הקפא';
    this.el.overlay.classList.remove('hidden');
    this.el.overlayMsg.textContent = 'לחצו על "התחל האזנה" כדי להפעיל את המיקרופון';
    this.setStatus(false, 'המיקרופון כבוי');
    this.resetReadouts();
    this.visualizer.resetPeaks();
    this.visualizer.clear();
  }

  toggleFreeze() {
    this.frozen = !this.frozen;
    this.el.freezeBtn.textContent = this.frozen ? '▶️ המשך' : '❄️ הקפא';
    this.setStatus(true, this.frozen ? 'התמונה מוקפאת' : 'מאזין למיקרופון...');
  }

  startLoop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const loop = () => {
      if (!this.mic.isRunning) return;
      if (!this.frozen) this.renderFrame();
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  renderFrame() {
    if (!this.mic.updateData()) return;

    const { analyser, freqData, timeData } = this.mic;
    const sampleRate = this.mic.sampleRate;
    const now = performance.now();

    // Pitch detection runs a few times per second - it is the expensive part
    if (now - this.lastDetection >= DETECT_INTERVAL) {
      this.lastDetection = now;
      const result = detectPitch(timeData, sampleRate);
      this.updateLevel(result.rms);

      if (result.freq > 0) {
        // Smooth small fluctuations, but jump immediately on a new note
        if (this.smoothedFreq > 0 && Math.abs(result.freq - this.smoothedFreq) / this.smoothedFreq < 0.06) {
          this.smoothedFreq = this.smoothedFreq * 0.6 + result.freq * 0.4;
        } else {
          this.smoothedFreq = result.freq;
        }
        this.currentFreq = this.smoothedFreq;
        this.lastValidAt = now;
        this.updateNoteReadout(this.smoothedFreq);
      } else if (now - this.lastValidAt > 700) {
        this.currentFreq = -1;
        this.smoothedFreq = 0;
        this.resetReadouts();
      }
    }

    this.updatePeakReadout(freqData, sampleRate, analyser.fftSize);

    this.visualizer.draw(
      freqData,
      sampleRate,
      analyser.fftSize,
      analyser.minDecibels,
      analyser.maxDecibels,
      this.currentFreq > 0 ? this.currentFreq : null,
    );
  }

  // Loudest single frequency component currently in the visible range
  updatePeakReadout(freqData, sampleRate, fftSize) {
    const binHz = sampleRate / fftSize;
    const maxBin = Math.min(freqData.length - 1, Math.floor(this.visualizer.maxFreq / binHz));
    const minBin = Math.max(1, Math.floor(MIN_DISPLAY_FREQ / binHz));

    let peakDb = -Infinity;
    let peakBin = -1;
    for (let b = minBin; b <= maxBin; b++) {
      if (freqData[b] > peakDb) {
        peakDb = freqData[b];
        peakBin = b;
      }
    }

    if (peakBin < 0 || peakDb < this.mic.analyser.minDecibels + 6) {
      this.el.peakFreq.textContent = '—';
      return;
    }
    this.el.peakFreq.textContent = Math.round(peakBin * binHz);
  }

  updateNoteReadout(freq) {
    const note = frequencyToNote(freq);
    this.el.noteHe.textContent = NOTE_NAMES_HE[note.index];
    this.el.noteEn.textContent = `${NOTE_NAMES_EN[note.index]}${note.octave}`;
    this.el.baseFreq.textContent = freq.toFixed(1);

    const cents = note.cents;
    const inTune = Math.abs(cents) <= 5;
    this.el.cents.textContent = inTune
      ? '✓ מכוון!'
      : cents > 0
        ? `גבוה ב-${cents} סנט`
        : `נמוך ב-${Math.abs(cents)} סנט`;
    this.el.cents.classList.toggle('in-tune', inTune);

    // Needle position: -50..+50 cents mapped to 0..100% of the bar
    const position = Math.max(-50, Math.min(50, cents));
    this.el.needle.style.insetInlineStart = `${50 + position}%`;
    this.el.needle.classList.toggle('in-tune', inTune);
    this.el.noteHe.classList.add('detected');
  }

  resetReadouts() {
    this.el.noteHe.textContent = '—';
    this.el.noteHe.classList.remove('detected');
    this.el.noteEn.textContent = '—';
    this.el.baseFreq.textContent = '—';
    this.el.cents.textContent = 'נגנו או שירו כדי לזהות תו';
    this.el.cents.classList.remove('in-tune');
    this.el.needle.style.insetInlineStart = '50%';
    this.el.needle.classList.remove('in-tune');
  }

  updateLevel(rms) {
    // rms is roughly 0..0.3 for normal input - scale it to a friendly bar
    const percent = Math.max(0, Math.min(100, Math.round(rms * 400)));
    this.el.level.style.width = `${percent}%`;
    this.el.level.classList.toggle('loud', percent > 85);
  }

  setStatus(active, text) {
    this.el.statusDot.classList.toggle('active', active);
    this.el.statusText.textContent = text;
  }

  showError(message) {
    if (!message) {
      this.el.error.style.display = 'none';
      this.el.error.textContent = '';
      return;
    }
    this.el.error.style.display = 'block';
    this.el.error.textContent = message;
  }

  handleMicError(error) {
    console.error('Microphone error:', error);
    let message;

    if (error && error.message === 'insecure') {
      message = 'גישה למיקרופון אפשרית רק בחיבור מאובטח (https) או ב-localhost.';
    } else if (error && error.message === 'unsupported') {
      message = 'הדפדפן הזה אינו תומך בגישה למיקרופון. נסו בדפדפן Chrome או Safari מעודכן.';
    } else if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      message = 'ההרשאה למיקרופון נדחתה. אפשרו גישה למיקרופון בהגדרות הדפדפן ונסו שוב.';
    } else if (error && error.name === 'NotFoundError') {
      message = 'לא נמצא מיקרופון במכשיר.';
    } else if (error && error.name === 'NotReadableError') {
      message = 'המיקרופון תפוס על ידי אפליקציה אחרת. סגרו אותה ונסו שוב.';
    } else {
      message = 'לא הצלחנו להפעיל את המיקרופון. נסו שוב.';
    }

    this.showError(message);
    this.el.overlayMsg.textContent = message;
    this.setStatus(false, 'המיקרופון כבוי');
  }

  setupModalControls() {
    const modal = document.getElementById('introModal');
    const infoBtn = document.getElementById('infoBtn');
    const closeBtn = modal.querySelector('.close-btn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const stepCounter = document.getElementById('stepCounter');

    let currentStep = 0;
    const totalSteps = modal.querySelectorAll('.tour-step').length;

    const showStep = (step) => {
      modal.querySelectorAll('.tour-step').forEach((el) => el.classList.remove('active'));
      const el = modal.querySelector(`.tour-step[data-step="${step}"]`);
      if (el) el.classList.add('active');
      stepCounter.textContent = `${step + 1} / ${totalSteps}`;
      prevBtn.disabled = step === 0;
      nextBtn.disabled = step === totalSteps - 1;
      currentStep = step;
    };

    infoBtn.addEventListener('click', () => { modal.classList.add('show'); showStep(currentStep); });
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

    nextBtn.addEventListener('click', () => { if (currentStep < totalSteps - 1) showStep(currentStep + 1); });
    prevBtn.addEventListener('click', () => { if (currentStep > 0) showStep(currentStep - 1); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        modal.classList.remove('show');
      } else if (modal.classList.contains('show')) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          if (currentStep < totalSteps - 1) showStep(currentStep + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          if (currentStep > 0) showStep(currentStep - 1);
        }
      }
    });

    setTimeout(() => { modal.classList.add('show'); showStep(0); }, 500);
  }
}

document.addEventListener('DOMContentLoaded', () => { new SpectrometerApp(); });
