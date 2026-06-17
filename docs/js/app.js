// Main Application - Student Interface

class FrequencyApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.bluetoothEngine = new BluetoothEngine();
    this.songPlayer = new SongPlayer(this.audioEngine);
    this.visualizer = new WaveformVisualizer('waveformCanvas');
    this.samples = [];
    this.currentFrequency = 440;
    this.selectedCategory = 'note';
    this.selectedOctave = 4;
    this.data = null;
    this.isResumeAvailable = false;
    this.superFrequencies = []; // Array of {freq, color}
    this.superColors = ['#e74c3c','#3498db','#27ae60','#f39c12','#9b59b6','#1abc9c','#e67e22','#2c3e50'];
    this.superColorIndex = 0;
    this.init();
  }

  async init() {
    await this.loadSamples();
    await this.songPlayer.loadSongs();
    this.setupEventListeners();
    this.setupTabs();
    this.visualizer.clear();
    this.updateSuperpositionDisplay();
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

        const wrapper = document.createElement('div');
        wrapper.className = 'sample-btn-wrapper';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sample-btn';

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

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'sample-add-super-btn';
        addBtn.title = 'הוסף לסופרפוזיציה';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.addToSuperposition(sample.frequency);
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(addBtn);
        buttonsDiv.appendChild(wrapper);
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
    this.isResumeAvailable = false;

    // Clear superposition when playing a single note exclusively
    this.clearSuperposition();

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

  addToSuperposition(frequency) {
    frequency = parseFloat(frequency);
    if (!Number.isFinite(frequency) || frequency <= 0) return;
    if (this.superFrequencies.find(item => item.freq === frequency)) return;

    const color = this.superColors[this.superColorIndex % this.superColors.length];
    this.superColorIndex++;
    this.superFrequencies.push({ freq: frequency, color });

    const volume = parseFloat(document.getElementById('volumeSlider').value) / 100;
    this.audioEngine.addSuperOscillator(frequency, volume);

    if (this.visualizer.isPaused || !this.audioEngine.isPlaying || !this.visualizer.animationId) {
      this.visualizer.resetTime();
      this.visualizer.isPaused = false;
      this.visualizer.capturedSample = null;
      this.visualizer.start(this.audioEngine);
    }

    this.updateSuperpositionDisplay();
    this.updateFreqInfoDisplay();
  }

  removeFromSuperposition(frequency) {
    frequency = parseFloat(frequency);
    this.superFrequencies = this.superFrequencies.filter(item => item.freq !== frequency);
    this.audioEngine.removeSuperOscillator(frequency);
    this.updateSuperpositionDisplay();
    this.updateFreqInfoDisplay();
  }

  clearSuperposition() {
    this.superFrequencies = [];
    this.superColorIndex = 0;
    this.audioEngine.clearSuperOscillators();
    this.updateSuperpositionDisplay();
    this.updateFreqInfoDisplay();
  }

  updateSuperpositionDisplay() {
    const list = document.getElementById('superFreqList');
    if (!list) return;

    if (this.superFrequencies.length === 0) {
      list.innerHTML = '<span class="super-empty">לחץ + להוסיף תדרים</span>';
      return;
    }

    list.innerHTML = '';
    this.superFrequencies.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'super-chip';
      chip.style.borderColor = item.color;
      chip.style.color = item.color;
      chip.innerHTML = `<span>${item.freq.toFixed(0)} Hz</span><button class="super-chip-remove" data-freq="${item.freq}" title="הסר">×</button>`;
      chip.querySelector('.super-chip-remove').addEventListener('click', (e) => {
        e.preventDefault();
        this.removeFromSuperposition(item.freq);
      });
      list.appendChild(chip);
    });
  }

  updateFreqInfoDisplay() {
    const vizFreqEl = document.getElementById('vizFreqDisplay');
    if (!vizFreqEl) return;
    if (this.superFrequencies.length === 0) {
      vizFreqEl.textContent = this.currentFrequency;
    } else {
      vizFreqEl.textContent = this.superFrequencies.map(f => f.freq.toFixed(0)).join(' + ');
    }
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

      // Only change gain while actually playing — don't re-activate a paused oscillator
      if (this.audioEngine.isPlaying) {
        this.audioEngine.setVolume(volumeNormalized);
      }

      // Redraw the paused waveform at the new volume level
      if (this.visualizer.isPaused) {
        const pauseFreq = this.superFrequencies.length === 0 ? this.currentFrequency : null;
        this.visualizer.pause(pauseFreq, volumeNormalized);
      }
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

      this.audioEngine.stop();
      this.isResumeAvailable = true;

      const volume = parseFloat(volumeSlider.value) / 100;
      // For superposition, use captured sample (null freq triggers fallback)
      const pauseFreq = this.superFrequencies.length === 0 ? this.currentFrequency : null;
      this.visualizer.pause(pauseFreq, volume);

      console.log(`Audio paused. Press Play to resume.`);
    });

    // Clear button - Clears audio, superposition, and visualizer
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();

      if (this.audioEngine.oscillator) {
        try { this.audioEngine.oscillator.stop(); } catch (err) {}
        this.audioEngine.oscillator = null;
      }

      this.clearSuperposition();
      this.audioEngine.isPlaying = false;
      this.isResumeAvailable = false;
      this.visualizer.clear();

      console.log('Cleared - Ready to play new frequency');
    });

    // Add to superposition button (custom tab)
    const addToSuperBtn = document.getElementById('addToSuperBtn');
    if (addToSuperBtn) {
      addToSuperBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addToSuperposition(this.currentFrequency);
      });
    }

    // Clear all superposition button
    const clearSuperBtn = document.getElementById('clearSuperBtn');
    if (clearSuperBtn) {
      clearSuperBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearSuperposition();
      });
    }

    // Resume audio context on user interaction
    document.addEventListener('click', () => {
      this.audioEngine.ensureContextRunning();
    });

    // Modal Controls
    this.setupModalControls();

    // Bluetooth Controls
    this.setupBluetoothControls();

    // Song Player Controls
    this.setupSongPlayerControls();
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

  setupSongPlayerControls() {
    const songsFabBtn = document.getElementById('songsFabBtn');
    const songsModal = document.getElementById('songsModal');
    const songModalCloseBtn = document.getElementById('songModalCloseBtn');
    const nowPlayingBar = document.getElementById('nowPlayingBar');
    const nowPlayingPauseBtn = document.getElementById('nowPlayingPauseBtn');
    const nowPlayingStopBtn = document.getElementById('nowPlayingStopBtn');

    if (this.songPlayer.songs.length === 0) return;

    this.renderSongsList();

    songsFabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      songsModal.classList.toggle('show');
    });

    const closeModal = () => songsModal.classList.remove('show');

    songModalCloseBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && songsModal.classList.contains('show')) closeModal();
    });

    nowPlayingPauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.songPlayer.isPlaying) {
        this.songPlayer.stopSong();
        this.visualizer.stop();
        nowPlayingPauseBtn.textContent = '▶️';
      } else {
        const songId = nowPlayingPauseBtn.dataset.songId;
        if (songId) {
          this.songPlayer.playSong(songId);
          this.visualizer.start(this.audioEngine);
          nowPlayingPauseBtn.textContent = '⏸️';
        }
      }
    });

    nowPlayingStopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.songPlayer.stopSong();
      this.visualizer.stop();
      this.visualizer.clear();
      document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
      nowPlayingBar.style.display = 'none';
    });

    this.songPlayer.onSongEnd = () => {
      this.visualizer.stop();
      document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
      nowPlayingBar.style.display = 'none';
    };
  }

  renderSongsList() {
    const songsList = document.getElementById('songsList');

    if (this.songPlayer.isPlaying) {
      return;
    }

    songsList.innerHTML = '';
    this.songPlayer.getSongs().forEach(song => {
      const songItem = document.createElement('div');
      songItem.className = 'song-item';
      songItem.dataset.songId = song.id;
      songItem.innerHTML = `
        <div class="song-name">${song.name}</div>
        <div class="song-name-he">${song.nameHe}</div>
      `;

      songItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.playSongFromModal(song.id, song.name, song.nameHe);
      });

      songsList.appendChild(songItem);
    });
  }

  playSongFromModal(songId, songName, songNameHe) {
    const nowPlayingBar = document.getElementById('nowPlayingBar');
    const nowPlayingBarTitle = document.getElementById('nowPlayingBarTitle');
    const nowPlayingPauseBtn = document.getElementById('nowPlayingPauseBtn');

    nowPlayingBarTitle.textContent = `♪ ${songName}`;
    nowPlayingPauseBtn.dataset.songId = songId;
    nowPlayingPauseBtn.textContent = '⏸️';
    nowPlayingBar.style.display = 'flex';

    // Highlight active song
    document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.song-item[data-song-id="${songId}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Wire per-note frequency updates into the visualizer display
    this.songPlayer.onNoteChange = (frequency) => {
      if (frequency > 0) {
        const vizFreqEl = document.getElementById('vizFreqDisplay');
        if (vizFreqEl) vizFreqEl.textContent = frequency;
      }
    };

    // Reset visualizer and start it so the canvas shows the song oscillation
    this.visualizer.resetTime();
    this.visualizer.isPaused = false;
    this.visualizer.capturedSample = null;

    this.songPlayer.playSong(songId);

    // Start after playSong so the audio context is initialized
    this.visualizer.start(this.audioEngine);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new FrequencyApp();
});
