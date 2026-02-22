// Audio Engine - Handles frequency generation and waveform visualization

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
    this.analyser = null;
    this.isPlaying = false;
    this.currentFrequency = 440;
    this.pendingSuspendId = null;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }
    
    // Create gain node and analyser only once
    if (!this.gainNode) {
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      
      // Connect gain and analyser to destination (permanent connection)
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      // Set gain (volume)
      this.gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      
      // Set analyser properties
      this.analyser.fftSize = 2048;
    }
    
    // If oscillator was stopped (cleared), create a new one
    if (!this.oscillator) {
      // Create new oscillator
      this.oscillator = this.audioContext.createOscillator();

      // Connect oscillator to gain node
      this.oscillator.connect(this.gainNode);

      // Set oscillator properties
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(this.currentFrequency, this.audioContext.currentTime);

      this.oscillator.start();
    }
  }

  // Play frequency
  play(frequency) {
    this.init();
    if (this.pendingSuspendId) {
      clearTimeout(this.pendingSuspendId);
      this.pendingSuspendId = null;
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.currentFrequency = frequency;
    this.oscillator.frequency.setTargetAtTime(
      frequency,
      this.audioContext.currentTime,
      0.01
    );
    
    // Cancel any pending volume changes and set to target volume
    this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05);
    
    this.isPlaying = true;
  }

  // Stop playing
  stop() {
    if (this.audioContext && this.gainNode) {
      // Pause by muting the audio (don't stop oscillator)
      this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.05);
      this.isPlaying = false;

      if (this.pendingSuspendId) {
        clearTimeout(this.pendingSuspendId);
      }

      this.pendingSuspendId = setTimeout(() => {
        if (!this.isPlaying && this.audioContext && this.audioContext.state === 'running') {
          this.audioContext.suspend();
        }
        this.pendingSuspendId = null;
      }, 80);
    }
  }

  // Resume playing (resume from pause)
  async resume() {
    // Resume audio context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (this.pendingSuspendId) {
      clearTimeout(this.pendingSuspendId);
      this.pendingSuspendId = null;
    }
    
    if (this.audioContext && this.gainNode && this.oscillator) {
      // Resume audio from pause by unmuting
      const targetVolume = 0.3; // Default volume
      this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(targetVolume, this.audioContext.currentTime + 0.05);
      this.isPlaying = true;
    }
  }

  // Resume audio context without changing playback state
  ensureContextRunning() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
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
      
      // Cancel scheduled values and smoothly transition to new volume
      this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(clampedVolume, this.audioContext.currentTime + 0.05);
    }
  }
}

// Waveform Visualizer
class WaveformVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.dataArray = null;
    this.capturedSample = null; // Snapshot sample taken while playing
    this.animationId = null;
    this.timeElapsed = 0;
    this.timeSinceStart = 0; // Time since animation started
    this.isPaused = false;
    this.pausedFrequency = null; // Store frequency when paused
    this.audioEngine = null; // Store reference to audioEngine

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

    // Draw paused indicator if paused
    if (this.isPaused) {
      this.drawPausedIndicator();
    }

    // Update time display
    if (!this.isPaused) {
      this.timeElapsed += (1 / 60) * 1000; // Approximate 60fps
      const seconds = (this.timeElapsed / 1000).toFixed(2);
      document.getElementById('timeDisplay').textContent = seconds;
    }
  }

  // Draw paused indicator on canvas
  drawPausedIndicator() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    this.ctx.fillRect(0, 0, width, height);

    // Paused text with frequency
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = 'rgba(118, 75, 162, 0.7)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const frequencyText = this.pausedFrequency ? `⏸️ Paused - ${this.pausedFrequency} Hz` : '⏸️ Paused';
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

  // Build an ideal sine waveform for the given frequency
  buildSineWaveData(frequency) {
    if (!Number.isFinite(frequency) || frequency <= 0) {
      return null;
    }

    const length = this.audioEngine && this.audioEngine.analyser
      ? this.audioEngine.analyser.fftSize
      : 2048;
    const sampleRate = this.audioEngine && this.audioEngine.audioContext
      ? this.audioEngine.audioContext.sampleRate
      : 44100;
    const data = new Uint8Array(length);
    const twoPi = Math.PI * 2;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const value = Math.sin(twoPi * frequency * t);
      data[i] = 128 + Math.round(127 * value);
    }

    return data;
  }

  // Start continuous animation and sample capturing
  start(audioEngine) {
    this.audioEngine = audioEngine;
    this.isPaused = false;
    this.timeSinceStart = 0;
    this.capturedSample = null; // Clear any old sample
    
    const animate = () => {
      const waveformData = audioEngine.getWaveformData();
      if (waveformData) {
        this.draw(waveformData);
        
        // Capture sample after 500ms of playing (to ensure clean waveform)
        this.timeSinceStart += (1 / 60) * 1000; // Approximate 60fps
        if (this.timeSinceStart >= 500 && !this.capturedSample) {
          // Check if this is real waveform data (not silence)
          let hasSignal = false;
          for (let i = 0; i < waveformData.length; i++) {
            if (waveformData[i] < 110 || waveformData[i] > 146) {
              hasSignal = true;
              break;
            }
          }
          
          if (hasSignal) {
            this.capturedSample = new Uint8Array(waveformData);
            console.log('Sample captured for pause display');
          }
        }
        
        // Update sample periodically while playing (every 2 seconds)
        if (this.timeSinceStart >= 500 && this.timeSinceStart % 2000 < 50) {
          let hasSignal = false;
          for (let i = 0; i < waveformData.length; i++) {
            if (waveformData[i] < 110 || waveformData[i] > 146) {
              hasSignal = true;
              break;
            }
          }
          
          if (hasSignal) {
            this.capturedSample = new Uint8Array(waveformData);
          }
        }
      }
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

  // Pause and display captured sample
  pause(frequency = null) {
    // Cancel any pending animation frame
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.isPaused = true;
    this.pausedFrequency = frequency;

    // Display an ideal sine waveform based on the paused frequency
    const sineData = this.buildSineWaveData(frequency);
    if (sineData) {
      this.draw(sineData);
      return;
    }

    // Fallback to captured sample or last data if sine data isn't available
    if (this.capturedSample) {
      this.draw(this.capturedSample);
    } else if (this.dataArray) {
      this.draw(this.dataArray);
    }
  }

  // Clear canvas and reset state
  clear() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, width, height);
    this.drawGrid();
    document.getElementById('timeDisplay').textContent = '0.00';
    this.isPaused = false;
    this.pausedFrequency = null;
    this.timeElapsed = 0;
    this.timeSinceStart = 0;
    this.dataArray = null;
    this.capturedSample = null; // Clear captured sample
  }

  // Reset time counter
  resetTime() {
    this.timeElapsed = 0;
    this.timeSinceStart = 0;
  }
}
