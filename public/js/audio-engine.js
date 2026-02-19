// Audio Engine - Handles frequency generation and waveform visualization

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
    this.analyser = null;
    this.isPlaying = false;
    this.currentFrequency = 440;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }
    
    // If oscillator was stopped (cleared), create a new one
    if (!this.oscillator) {
      // Create nodes
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();

      // Connect nodes
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // Set oscillator properties
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(this.currentFrequency, this.audioContext.currentTime);

      // Set gain (volume)
      this.gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);

      // Set analyser properties
      this.analyser.fftSize = 2048;

      this.oscillator.start();
    }
  }

  // Play frequency
  play(frequency) {
    this.init();
    this.currentFrequency = frequency;
    this.oscillator.frequency.setTargetAtTime(
      frequency,
      this.audioContext.currentTime,
      0.01
    );
    this.gainNode.gain.setTargetAtTime(0.3, this.audioContext.currentTime, 0.01);
    this.isPlaying = true;
  }

  // Stop playing
  stop() {
    if (this.audioContext && this.gainNode) {
      // Pause by muting the audio (don't stop oscillator)
      this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
      this.isPlaying = false;
    }
  }

  // Resume playing (resume from pause)
  resume() {
    if (this.audioContext && this.gainNode && this.oscillator) {
      // Resume audio from pause
      const targetVolume = 0.3; // Default volume
      this.gainNode.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.1);
      this.isPlaying = true;
    }
  }

  // Get frequency data for visualization
  getFrequencyData() {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // Get time domain data for waveform
  getWaveformData() {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  // Change frequency
  setFrequency(frequency) {
    this.currentFrequency = frequency;
    if (this.oscillator && this.audioContext) {
      this.oscillator.frequency.setTargetAtTime(
        frequency,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  // Set volume (0-1 range)
  setVolume(volume) {
    if (this.gainNode && this.audioContext) {
      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.gainNode.gain.setTargetAtTime(
        clampedVolume,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  // Resume audio context if suspended
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Waveform Visualizer
class WaveformVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.dataArray = null;
    this.lastGoodWaveformData = null; // Backup of the last good waveform
    this.animationId = null;
    this.timeElapsed = 0;
    this.isFrozen = false;
    this.frozenFrequency = null; // Store frequency when frozen
    this.audioEngine = null; // Store reference to audioEngine for freeze()

    // Set canvas resolution
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  // Update and draw waveform
  draw(dataArray) {
    if (!dataArray) return;

    this.dataArray = dataArray;
    
    // Check if this is real waveform data (not all silence/zeros)
    // If it's a real waveform, save it as backup for freeze
    let hasSignal = false;
    for (let i = 0; i < dataArray.length; i++) {
      if (dataArray[i] < 110 || dataArray[i] > 146) {
        hasSignal = true;
        break;
      }
    }
    
    // Only save if it has actual signal (not silence)
    if (hasSignal) {
      this.lastGoodWaveformData = new Uint8Array(dataArray);
    }

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, width, height);

    // Draw grid
    this.drawGrid();

    // Draw waveform
    this.ctx.strokeStyle = '#667eea';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    const sliceWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.stroke();

    // Draw frozen indicator if frozen
    if (this.isFrozen) {
      this.drawFrozenIndicator();
    }

    // Update time display
    if (!this.isFrozen) {
      this.timeElapsed += (1 / 60) * 1000; // Approximate 60fps
      const seconds = (this.timeElapsed / 1000).toFixed(2);
      document.getElementById('timeDisplay').textContent = seconds;
    }
  }

  // Draw frozen indicator on canvas
  drawFrozenIndicator() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.fillRect(0, 0, width, height);

    // Frozen text with frequency
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = 'rgba(118, 75, 162, 0.7)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const frequencyText = this.frozenFrequency ? `🔒 ${this.frozenFrequency} Hz` : '🔒 מקוּפא (Frozen)';
    this.ctx.fillText(frequencyText, width / 2, height / 2);
  }

  // Draw grid on canvas
  drawGrid() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const gridSpacingX = 40;
    const gridSpacingY = 30;

    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < width; x += gridSpacingX) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += gridSpacingY) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    // Center line (zero crossing)
    this.ctx.strokeStyle = '#764ba2';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);
    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
  }

  // Start continuous animation
  start(audioEngine) {
    this.audioEngine = audioEngine; // Store reference for freeze()
    this.isFrozen = false; // Unfreeze when starting new animation
    const animate = () => {
      const waveformData = audioEngine.getWaveformData();
      this.draw(waveformData);
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  // Stop animation
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // Freeze the current waveform for explanation
  freeze(frequency = null) {
    // Cancel any pending animation frame
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Use the last good waveform data captured (before audio was muted)
    const waveformToFreeze = this.lastGoodWaveformData || this.dataArray;
    
    this.isFrozen = true;
    this.frozenFrequency = frequency;
    
    // Redraw with the good waveform data
    if (waveformToFreeze) {
      this.draw(waveformToFreeze);
      this.drawFrozenIndicator();
    }
  }

  // Unfreeze and clear
  clear() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, width, height);
    this.drawGrid();
    document.getElementById('timeDisplay').textContent = '0.00';
    this.isFrozen = false;
    this.frozenFrequency = null;
    this.timeElapsed = 0;
    this.dataArray = null;
    this.lastGoodWaveformData = null; // Reset waveform backup
  }

  // Reset time counter
  resetTime() {
    this.timeElapsed = 0;
  }
}
