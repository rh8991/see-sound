// Main Application - Student Interface

class FrequencyApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.bluetoothEngine = new BluetoothEngine();
    this.visualizer = new WaveformVisualizer('waveformCanvas');
    this.samples = [];
    this.currentFrequency = 440;
    this.selectedCategory = 'note'; // Default category
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

      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'samples-grid';

      categories[categoryKey].forEach(sample => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sample-btn';
        btn.textContent = `${sample.name}\n${sample.frequency} Hz`;
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

    // Reset visualizer timer and unfreeze
    this.visualizer.resetTime();
    this.visualizer.isFrozen = false;
    this.visualizer.frozenFrequency = null;
    this.visualizer.lastGoodWaveformData = null; // Reset waveform backup

    // Show console message
    console.log(`Playing: ${name} - ${frequency} Hz`);

    // Start visualization
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
        
        // Unfreeze the waveform and continue animation
        this.visualizer.isFrozen = false;
        this.visualizer.frozenFrequency = null;
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

        // Reset visualizer timer and unfreeze
        this.visualizer.resetTime();
        this.visualizer.isFrozen = false;
        this.visualizer.frozenFrequency = null;

        // Start visualization
        console.log(`Playing custom frequency: ${this.currentFrequency} Hz`);
        this.visualizer.start(this.audioEngine);
      }
    });

    // Stop button - Pauses audio and freezes waveform for examination
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
      
      // Freeze the waveform so student can examine it
      this.visualizer.freeze(this.currentFrequency);
      
      console.log(`Audio paused - Waveform frozen at ${this.currentFrequency} Hz. Press Play to resume.`);
    });

    // Clear button - Clears the frozen waveform
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
      
      // Reset frozen state
      this.visualizer.isFrozen = false;
      this.visualizer.frozenFrequency = null;
      
      console.log('Waveform cleared - Ready to play new frequency');
    });

    // Resume audio context on user interaction
    document.addEventListener('click', () => {
      this.audioEngine.resume();
    });

    // Bluetooth Controls
    this.setupBluetoothControls();
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
