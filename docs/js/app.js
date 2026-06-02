// Main Application - Student Interface

class FrequencyApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.bluetoothEngine = new BluetoothEngine();
    this.visualizer = new WaveformVisualizer('waveformCanvas');
    this.samples = [];
    this.currentFrequency = 440;
    this.selectedCategory = 'note'; // Default category
    this.selectedOctave = 4; // Default octave
    this.data = null; // Store full frequency data
    this.isResumeAvailable = false; // Track if resume action is available (only after pause, not after new sample)
    this.init();
  }

  async init() {
    // Load samples from server
    await this.loadSamples();

    // Setup event listeners
    this.setupEventListeners();

    // Setup tab switching
    this.setupTabs();

    // Draw initial waveform
    this.visualizer.clear();
  }

  async loadSamples() {
    try {
      const data = await API.getFrequencies();
      this.samples = data.samples;
      this.data = data; // Store full data

      this.renderSamples(data);
    } catch (error) {
      console.error('Failed to load samples:', error);
    }
  }

  renderSamples(data) {
    const container = document.getElementById('samplesContainer');
    container.innerHTML = '';

    // Group samples by category
    const categories = {};
    data.samples.forEach(sample => {
      if (!categories[sample.category]) {
        categories[sample.category] = [];
      }
      categories[sample.category].push(sample);
    });

    // Define category order
    const categoryOrder = ['note', 'freq'];

    // Render samples organized by category
    categoryOrder.forEach(categoryKey => {
      if (!categories[categoryKey]) return;

      const categoryName = data.categoryNames[categoryKey] || categoryKey;
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'sample-category';
      categoryDiv.dataset.category = categoryKey;

      const categoryTitle = document.createElement('h3');
      categoryTitle.textContent = categoryName;
      categoryDiv.appendChild(categoryTitle);

      // For notes category, add octave selector with arrow controls
      if (categoryKey === 'note') {
        const octaveSelectorDiv = document.createElement('div');
        octaveSelectorDiv.className = 'octave-selector';
        
        // Get unique octaves from notes
        const noteOctaves = [...new Set(
          categories['note']
            .filter(s => s.octave !== undefined)
            .map(s => s.octave)
        )].sort((a, b) => a - b);

        const minOctave = Math.min(...noteOctaves);
        const maxOctave = Math.max(...noteOctaves);

        // Left arrow button
        const leftArrowBtn = document.createElement('button');
        leftArrowBtn.type = 'button';
        leftArrowBtn.className = 'octave-arrow-btn octave-arrow-left';
        leftArrowBtn.textContent = '▶';
        leftArrowBtn.title = 'אוקטבה נמוכה יותר';
        leftArrowBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.selectedOctave > minOctave) {
            this.selectedOctave--;
            this.renderSamples(data);
          }
        });
        octaveSelectorDiv.appendChild(leftArrowBtn);

        // Octave display
        const octaveDisplay = document.createElement('div');
        octaveDisplay.className = 'octave-display';
        octaveDisplay.textContent = `אוקטבה ${this.selectedOctave}`;
        octaveSelectorDiv.appendChild(octaveDisplay);

        // Right arrow button
        const rightArrowBtn = document.createElement('button');
        rightArrowBtn.type = 'button';
        rightArrowBtn.className = 'octave-arrow-btn octave-arrow-right';
        rightArrowBtn.textContent = '◀';
        rightArrowBtn.title = 'אוקטבה גבוהה יותר';
        rightArrowBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.selectedOctave < maxOctave) {
            this.selectedOctave++;
            this.renderSamples(data);
          }
        });
        octaveSelectorDiv.appendChild(rightArrowBtn);

        categoryDiv.appendChild(octaveSelectorDiv);
      }

      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'samples-grid';

      categories[categoryKey].forEach(sample => {
        // Skip notes that don't match the selected octave
        if (categoryKey === 'note' && sample.octave !== this.selectedOctave) {
          return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sample-btn';
        
        // Format display text based on whether it has octave info
        let displayText = sample.name;
        if (sample.octave !== undefined) {
          displayText = `${sample.noteSymbol}${sample.octave}`;
        }
        
        btn.textContent = `${displayText}\n${sample.frequency.toFixed(2)} Hz`;
        btn.dataset.frequency = sample.frequency;
        btn.dataset.name = sample.name;
        btn.dataset.category = categoryKey;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.playSample(sample.frequency, sample.name);
          this.setActiveButton(btn);
        });

        buttonsDiv.appendChild(btn);
      });

      categoryDiv.appendChild(buttonsDiv);
      container.appendChild(categoryDiv);
    });

    // Filter by selected category
    this.filterSamplesByCategory();
  }

  filterSamplesByCategory() {
    const categories = document.querySelectorAll('.sample-category');
    categories.forEach(cat => {
      const catKey = cat.dataset.category;
      if (catKey === this.selectedCategory) {
        cat.style.display = 'block';
      } else {
        cat.style.display = 'none';
      }
    });
  }

  playSample(frequency, name) {
    this.currentFrequency = frequency;
    
    // No resume available when starting fresh - we're playing a new frequency
    this.isResumeAvailable = false;
    
    // Stop any previously paused oscillator to start fresh
    if (this.audioEngine.oscillator) {
      try {
        this.audioEngine.oscillator.stop();
      } catch (err) {
        // Already stopped
      }
      this.audioEngine.oscillator = null;
    }
    
    // Start fresh audio
    this.audioEngine.init();
    this.audioEngine.play(frequency);

    // Set volume from slider
    const volumeSlider = document.getElementById('volumeSlider');
    const volume = parseFloat(volumeSlider.value) / 100;
    this.audioEngine.setVolume(volume);

    // Update display
    document.getElementById('freqDisplay').textContent = `${frequency} Hz`;
    document.getElementById('customFreq').value = frequency;
    document.getElementById('customFreqInput').value = frequency;
    document.getElementById('vizFreqDisplay').textContent = frequency;

    // Reset visualizer timer and clear old sample/pause state
    this.visualizer.resetTime();
    this.visualizer.isPaused = false;
    this.visualizer.pausedFrequency = null;
    this.visualizer.capturedSample = null; // Clear old sample

    // Show console message
    console.log(`Playing: ${name} - ${frequency} Hz`);

    // Start visualization (will capture new sample)
    this.visualizer.start(this.audioEngine);
  }

  setActiveButton(btn) {
    // Remove active class from all buttons
    document.querySelectorAll('.sample-btn').forEach(b => {
      b.classList.remove('active');
    });
    // Add active class to clicked button
    btn.classList.add('active');
  }

  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Update active tab button
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active tab pane
        tabPanes.forEach(pane => pane.classList.remove('active'));
        document.getElementById(`${targetTab}-tab`).classList.add('active');
      });
    });

    // Setup category tabs within notes tab
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        this.selectedCategory = category;

        // Update active category button
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter samples
        this.filterSamplesByCategory();
      });
    });
  }

  setupEventListeners() {
    // Custom frequency slider
    const freqSlider = document.getElementById('customFreq');
    const freqInput = document.getElementById('customFreqInput');
    const freqDisplay = document.getElementById('freqDisplay');

    const updateFrequency = (value) => {
      value = Math.max(20, Math.min(20000, parseFloat(value)));
      this.currentFrequency = value;

      freqSlider.value = value;
      freqInput.value = value;
      freqDisplay.textContent = `${value.toFixed(0)} Hz`;
      document.getElementById('vizFreqDisplay').textContent = value.toFixed(0);

      // Update audio if playing
      if (this.audioEngine.isPlaying) {
        this.audioEngine.setFrequency(value);
      }
    };

    freqSlider.addEventListener('input', (e) => {
      updateFrequency(e.target.value);
    });

    freqInput.addEventListener('change', (e) => {
      updateFrequency(e.target.value);
    });

    freqInput.addEventListener('input', (e) => {
      updateFrequency(e.target.value);
    });

    // Volume slider
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeDisplay = document.getElementById('volumeDisplay');

    const updateVolume = (value) => {
      value = Math.max(0, Math.min(100, parseFloat(value)));
      const volumeNormalized = value / 100;
      
      volumeSlider.value = value;
      volumeDisplay.textContent = `${value.toFixed(0)}%`;

      // Update audio engine volume
      this.audioEngine.setVolume(volumeNormalized);
    };

    volumeSlider.addEventListener('input', (e) => {
      updateVolume(e.target.value);
    });

    // Play button
    const playBtn = document.getElementById('playCustomBtn');
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Only resume if we explicitly paused and haven't clicked a new sample
      if (this.isResumeAvailable && !this.audioEngine.isPlaying) {
        // Apply current volume when resuming
        const volume = parseFloat(volumeSlider.value) / 100;
        this.audioEngine.setVolume(volume);
        this.audioEngine.resume();
        
        // Continue animation (will capture new samples)
        this.visualizer.start(this.audioEngine);
        console.log(`Resumed playing: ${this.currentFrequency} Hz`);
        this.isResumeAvailable = false; // Consumed the resume opportunity
        return;
      }
      
      // Otherwise, start a fresh frequency (shouldn't normally reach here if audio already playing)
      if (!this.audioEngine.isPlaying) {
        this.audioEngine.init();
        this.audioEngine.play(this.currentFrequency);

        // Set volume from slider
        const volume = parseFloat(volumeSlider.value) / 100;
        this.audioEngine.setVolume(volume);

        // Remove active class from sample buttons
        document.querySelectorAll('.sample-btn').forEach(b => {
          b.classList.remove('active');
        });

        // Reset visualizer timer and clear old sample
        this.visualizer.resetTime();
        this.visualizer.isPaused = false;
        this.visualizer.pausedFrequency = null;
        this.visualizer.capturedSample = null;

        // Start visualization
        console.log(`Playing custom frequency: ${this.currentFrequency} Hz`);
        this.visualizer.start(this.audioEngine);
      }
    });

    // Stop button - Pauses audio and displays captured sample
    const stopBtn = document.getElementById('stopBtn');
    stopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (!this.audioEngine.isPlaying) {
        console.log('Audio is not playing');
        return;
      }
      
      // Pause the audio by muting it
      this.audioEngine.stop();
      
      // Mark that resume is now available
      this.isResumeAvailable = true;
      
      // Pause the visualization and display the captured sample
      const volume = parseFloat(volumeSlider.value) / 100;
      this.visualizer.pause(this.currentFrequency, volume);
      
      console.log(`Audio paused - Displaying captured sample at ${this.currentFrequency} Hz. Press Play to resume.`);
    });

    // Clear button - Clears the paused sample
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Stop any audio that might be paused
      if (this.audioEngine.oscillator) {
        try {
          this.audioEngine.oscillator.stop();
        } catch (err) {
          // Oscillator already stopped
        }
        this.audioEngine.oscillator = null;
      }
      
      // Reset audio state
      this.audioEngine.isPlaying = false;
      this.isResumeAvailable = false;
      
      // Clear the visualizer
      this.visualizer.clear();
      
      console.log('Sample cleared - Ready to play new frequency');
    });

    // Resume audio context on user interaction
    document.addEventListener('click', () => {
      this.audioEngine.ensureContextRunning();
    });

    // Modal Controls
    this.setupModalControls();

    // Bluetooth Controls
    this.setupBluetoothControls();
  }

  setupModalControls() {
    const infoBtn = document.getElementById('infoBtn');
    const modal = document.getElementById('introModal');
    const closeBtn = document.querySelector('.close-btn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const stepCounter = document.getElementById('stepCounter');

    let currentStep = 0;
    const totalSteps = document.querySelectorAll('.tour-step').length;

    const showStep = (step) => {
      // Hide all steps
      document.querySelectorAll('.tour-step').forEach(el => {
        el.classList.remove('active');
      });

      // Show current step
      const currentStepEl = document.querySelector(`.tour-step[data-step="${step}"]`);
      if (currentStepEl) {
        currentStepEl.classList.add('active');
      }

      // Update counter
      stepCounter.textContent = `${step + 1} / ${totalSteps}`;

      // Update button states
      prevBtn.disabled = step === 0;
      nextBtn.disabled = step === totalSteps - 1;

      currentStep = step;
    };

    // Open modal
    infoBtn.addEventListener('click', () => {
      modal.classList.add('show');
      showStep(currentStep);
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('show');
    });

    // Close modal when clicking outside the content
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        modal.classList.remove('show');
      }
    });

    // Next button
    nextBtn.addEventListener('click', () => {
      if (currentStep < totalSteps - 1) {
        showStep(currentStep + 1);
      }
    });

    // Previous button
    prevBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        showStep(currentStep - 1);
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('show')) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (currentStep < totalSteps - 1) {
          showStep(currentStep + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (currentStep > 0) {
          showStep(currentStep - 1);
        }
      }
    });

    // Show the modal automatically on page load
    setTimeout(() => {
      modal.classList.add('show');
      showStep(0);
    }, 500);
  }

  setupBluetoothControls() {
    const scanBtn = document.getElementById('scanBluetoothBtn');
    const devicesList = document.getElementById('bluetoothDevicesList');
    const connectedInfo = document.getElementById('connectedDeviceInfo');
    const disconnectBtn = document.getElementById('disconnectBluetoothBtn');
    const statusIcon = document.getElementById('bluetoothStatusIcon');
    const statusText = document.getElementById('bluetoothStatusText');

    // Check if Bluetooth is available
    if (!this.bluetoothEngine.isAvailable()) {
      scanBtn.disabled = true;
      scanBtn.textContent = '❌ בלוטוס לא זמין';
      devicesList.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 15px;">בלוטוס לא נתמך בדפדפן זה</p>';
      return;
    }

    // Scan button
    scanBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      scanBtn.disabled = true;
      scanBtn.textContent = '🔄 סורק...';

      const success = await this.bluetoothEngine.scanDevices((device) => {
        this.addDeviceToList(device);
      });

      if (!success) {
        devicesList.innerHTML = '<p style="text-align: center; color: #666; padding: 15px;">סריקה בוטלה או נכשלה</p>';
      }

      scanBtn.disabled = false;
      scanBtn.textContent = '🔍 סריקה';
    });

    // Disconnect button
    disconnectBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const success = await this.bluetoothEngine.disconnectDevice();
      
      if (success) {
        connectedInfo.style.display = 'none';
        devicesList.style.display = 'block';
        statusIcon.textContent = '📡';
        statusText.textContent = 'לא מחובר';
        console.log('Disconnected from Bluetooth device');
      }
    });
  }

  addDeviceToList(device) {
    const devicesList = document.getElementById('bluetoothDevicesList');
    
    // Clear the "no devices" message
    if (devicesList.querySelector('p')) {
      devicesList.innerHTML = '';
    }

    // Create device element
    const deviceElement = document.createElement('div');
    deviceElement.className = 'bluetooth-device-item';
    deviceElement.innerHTML = `
      <div class="device-name">${device.name || 'Unnamed Device'}</div>
      <div class="device-id" style="font-size: 0.75em; color: #999;">${device.id}</div>
      <button class="device-connect-btn" data-device-id="${device.id}">🔗 חבר</button>
    `;

    devicesList.appendChild(deviceElement);

    // Add connect button listener
    const connectBtn = deviceElement.querySelector('.device-connect-btn');
    connectBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      connectBtn.disabled = true;
      connectBtn.textContent = '⏳ חיבור...';

      const success = await this.bluetoothEngine.connectDevice(device.id);

      if (success) {
        const connectedDevice = this.bluetoothEngine.getConnectedDevice();
        
        // Update UI
        document.getElementById('bluetoothDevicesList').style.display = 'none';
        document.getElementById('connectedDeviceInfo').style.display = 'block';
        document.getElementById('connectedDeviceName').textContent = connectedDevice.name;
        
        const connectionTime = new Date(connectedDevice.connectedAt).toLocaleTimeString('he-IL');
        document.getElementById('connectedDeviceTime').textContent = `מחובר ב: ${connectionTime}`;
        
        document.getElementById('bluetoothStatusIcon').textContent = '✅';
        document.getElementById('bluetoothStatusText').textContent = `מחובר ל: ${connectedDevice.name}`;

        console.log(`Connected to ${connectedDevice.name}`);
      } else {
        connectBtn.textContent = '❌ נכשל';
        setTimeout(() => {
          connectBtn.disabled = false;
          connectBtn.textContent = '🔗 חבר';
        }, 2000);
      }
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new FrequencyApp();
});
