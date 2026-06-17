// Simon Game

const NOTES = [
  { symbol: 'C', nameHe: 'דו',  freq: 261.63, color: '#e74c3c', textDark: false },
  { symbol: 'D', nameHe: 'רה',  freq: 293.66, color: '#e67e22', textDark: false },
  { symbol: 'E', nameHe: 'מי',  freq: 329.63, color: '#ebc427', textDark: false },
  { symbol: 'F', nameHe: 'פה',  freq: 349.23, color: '#27ae60', textDark: false },
  { symbol: 'G', nameHe: 'סול', freq: 392.00, color: '#1abc9c', textDark: false },
  { symbol: 'A', nameHe: 'לה',  freq: 440.00, color: '#3498db', textDark: false },
  { symbol: 'B', nameHe: 'סי',  freq: 493.88, color: '#9b59b6', textDark: false },
];

const NOTE_DURATION  = 650;
const NOTE_GAP       = 120;
const FLASH_DURATION = 550;

class SimonGame {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.visualizer  = new WaveformVisualizer('simonCanvas');
    this.sequence    = [];
    this.userStep    = 0;
    this.state       = 'idle';
    this.best        = parseInt(localStorage.getItem('simonBest') || '0');
    this.buttons     = [];

    this._buildButtons();
    this._bindUI();
    this._setupModal();
    this.visualizer.clear();
    document.getElementById('bestDisplay').textContent = this.best;
  }

  _buildButtons() {
    const grid = document.getElementById('noteButtonsGrid');
    NOTES.forEach((note, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-btn';
      btn.style.background = note.color;
      if (note.textDark) btn.style.color = '#333';
      btn.innerHTML = `
        <span class="note-symbol">${note.symbol}</span>
        <span class="note-name-he">${note.nameHe}</span>
        <span class="note-freq">${note.freq} Hz</span>
      `;
      btn.disabled = true;
      btn.addEventListener('click', () => this._onUserPress(idx));
      grid.appendChild(btn);
      this.buttons.push(btn);
    });
  }

  _bindUI() {
    document.getElementById('startBtn').addEventListener('click', () => this._startGame());
    document.getElementById('replayBtn').addEventListener('click', () => {
      if (this.state === 'listening') {
        this.state = 'playing';
        this._setListening(false);
        document.getElementById('replayBtn').disabled = true;
        this._playSequence().then(() => {
          this.state = 'listening';
          this._setListening(true);
          document.getElementById('replayBtn').disabled = false;
        });
      }
    });
    document.getElementById('overlayRestartBtn').addEventListener('click', () => {
      document.getElementById('gameOverlay').classList.remove('show');
      this._startGame();
    });
    document.addEventListener('click', () => this.audioEngine.ensureContextRunning());
  }

  _startGame() {
    this.sequence = [];
    this.userStep = 0;
    this.state    = 'playing';
    document.getElementById('gameOverlay').classList.remove('show');
    document.getElementById('startBtn').textContent = '↺ חדש';
    document.getElementById('replayBtn').disabled   = true;
    this._setListening(false);
    this._updateScore();
    this._addNote();
    this._playSequence().then(() => {
      this.state    = 'listening';
      this.userStep = 0;
      this._setListening(true);
      document.getElementById('replayBtn').disabled = false;
      this._setStatus('תורך! חזור על הרצף');
      this._updateDots(0);
    });
  }

  _addNote() {
    this.sequence.push(Math.floor(Math.random() * NOTES.length));
    this._buildDots();
    this._updateScore();
  }

  _updateScore() {
    document.getElementById('roundDisplay').textContent = this.sequence.length;
    document.getElementById('stepDisplay').textContent  =
      this.state === 'listening'
        ? `${this.userStep}/${this.sequence.length}`
        : `0/${this.sequence.length}`;
  }

  async _playSequence() {
    this._setStatus('האזן לרצף...');
    for (let i = 0; i < this.sequence.length; i++) {
      await this._playNote(this.sequence[i], NOTE_DURATION);
      await this._sleep(NOTE_GAP);
    }
  }

  _playNote(noteIdx, duration) {
    return new Promise(resolve => {
      const note   = NOTES[noteIdx];
      const canvas = document.getElementById('simonCanvas');
      const label  = document.getElementById('noteLabel');

      this.audioEngine.init();
      const ctx = this.audioEngine.audioContext;

      const start = () => {
        this.audioEngine.play(note.freq);
        this.audioEngine.setVolume(0.5);

        this._flashButton(noteIdx, FLASH_DURATION);

        canvas.style.setProperty('--active-color', note.color);
        canvas.classList.add('active-note');

        // Dynamic colours driven by note data — set in JS intentionally
        label.textContent      = `${note.symbol}  ${note.nameHe}  —  ${note.freq} Hz`;
        label.style.background = note.color + '22';
        label.style.color      = note.textDark ? '#333' : note.color;

        this.visualizer.start(this.audioEngine);

        setTimeout(() => {
          this.audioEngine.stop();
          this.visualizer.pause(note.freq, 0.5);
          canvas.classList.remove('active-note');
          resolve();
        }, duration);
      };

      // Only start the duration timer after the context is running — if stop()
      // fires while currentTime is still 0 (suspended), cancelScheduledValues(0)
      // wipes every gain event and the note plays silently.
      if (ctx.state === 'running') {
        start();
      } else {
        ctx.resume().then(start);
      }
    });
  }

  _flashButton(idx, duration) {
    const btn = this.buttons[idx];
    btn.classList.add('lit');
    setTimeout(() => btn.classList.remove('lit'), duration);
  }

  _onUserPress(idx) {
    if (this.state !== 'listening') return;

    const expected = this.sequence[this.userStep];
    this._playNote(idx, 350);

    if (idx !== expected) {
      this._gameOver();
      return;
    }

    this.userStep++;
    this._updateDots(this.userStep);
    this._updateScore();

    if (this.userStep === this.sequence.length) {
      this.state = 'playing';
      this._setListening(false);
      document.getElementById('replayBtn').disabled = true;

      const round = this.sequence.length;
      if (round > this.best) {
        this.best = round;
        localStorage.setItem('simonBest', this.best);
        document.getElementById('bestDisplay').textContent = this.best;
      }

      this._setStatus(`כל הכבוד! עבר לשלב ${round + 1}`);

      setTimeout(() => {
        this._addNote();
        this._playSequence().then(() => {
          this.state    = 'listening';
          this.userStep = 0;
          this._setListening(true);
          document.getElementById('replayBtn').disabled = false;
          this._setStatus('תורך! חזור על הרצף');
          this._updateDots(0);
        });
      }, 800);
    }
  }

  _gameOver() {
    this.state = 'gameover';
    this._setListening(false);
    document.getElementById('replayBtn').disabled = true;
    document.getElementById('overlayEmoji').textContent = '❌';
    document.getElementById('overlayMsg').textContent   =
      `טעות! הגעת לסיבוב ${this.sequence.length}`;
    document.getElementById('gameOverlay').classList.add('show');
    this._setStatus('שגיאה!');
  }

  _setListening(on) {
    this.buttons.forEach(btn => { btn.disabled = !on; });
  }

  _setStatus(msg) {
    document.getElementById('simonStatus').textContent = msg;
  }

  _buildDots() {
    const container = document.getElementById('sequenceDots');
    container.innerHTML = '';
    this.sequence.forEach(() => {
      const dot = document.createElement('div');
      dot.className = 'seq-dot';
      container.appendChild(dot);
    });
  }

  _updateDots(doneCount) {
    document.querySelectorAll('.seq-dot').forEach((dot, i) => {
      dot.classList.remove('done', 'current');
      if (i < doneCount)        dot.classList.add('done');
      else if (i === doneCount) dot.classList.add('current');
    });
  }

  _setupModal() {
    const modal       = document.getElementById('introModal');
    const infoBtn     = document.getElementById('infoBtn');
    const closeBtn    = modal.querySelector('.close-btn');
    const prevBtn     = document.getElementById('prevBtn');
    const nextBtn     = document.getElementById('nextBtn');
    const stepCounter = document.getElementById('stepCounter');

    let currentStep = 0;
    const totalSteps = modal.querySelectorAll('.tour-step').length;

    const showStep = (step) => {
      modal.querySelectorAll('.tour-step').forEach(el => el.classList.remove('active'));
      const el = modal.querySelector(`.tour-step[data-step="${step}"]`);
      if (el) el.classList.add('active');
      stepCounter.textContent = `${step + 1} / ${totalSteps}`;
      prevBtn.disabled = step === 0;
      nextBtn.disabled = step === totalSteps - 1;
      currentStep = step;
    };

    infoBtn.addEventListener('click', () => { modal.classList.add('show'); showStep(currentStep); });
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

    nextBtn.addEventListener('click', () => { if (currentStep < totalSteps - 1) showStep(currentStep + 1); });
    prevBtn.addEventListener('click', () => { if (currentStep > 0) showStep(currentStep - 1); });

    document.addEventListener('keydown', e => {
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

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

document.addEventListener('DOMContentLoaded', () => { new SimonGame(); });
