// Song Player - Manages loading and playing songs with note sequences

class SongPlayer {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.currentSong = null;
    this.isPlaying = false;
    this.currentNoteIndex = 0;
    this.playTimeoutId = null;
    this.songs = [];
  }

  // Load songs from JSON file
  async loadSongs() {
    try {
      const response = await fetch('data/songs.json');
      const data = await response.json();
      this.songs = data.songs;
      return this.songs;
    } catch (error) {
      console.error('Error loading songs:', error);
      return [];
    }
  }

  // Play a song by ID
  playSong(songId) {
    const song = this.songs.find(s => s.id === songId);
    if (!song) {
      console.error('Song not found:', songId);
      return;
    }

    this.currentSong = song;
    this.currentNoteIndex = 0;
    this.isPlaying = true;

    this.playNextNote();
  }

  // Play the next note in the sequence
  playNextNote() {
    if (!this.isPlaying || !this.currentSong) {
      return;
    }

    if (this.currentNoteIndex >= this.currentSong.notes.length) {
      // Song finished
      this.isPlaying = false;
      this.currentNoteIndex = 0;
      this.audioEngine.stop();
      if (this.onSongEnd) this.onSongEnd();
      return;
    }

    const note = this.currentSong.notes[this.currentNoteIndex];
    const durationMs = note.duration * 1000;

    if (this.onNoteChange) this.onNoteChange(note.frequency);

    if (note.frequency > 0) {
      this.audioEngine.play(note.frequency);
    } else {
      // Rest (frequency 0)
      this.audioEngine.stop();
    }

    this.currentNoteIndex++;

    // Schedule next note
    this.playTimeoutId = setTimeout(() => {
      this.playNextNote();
    }, durationMs);
  }

  // Stop playing the current song
  stopSong() {
    this.isPlaying = false;
    if (this.playTimeoutId) {
      clearTimeout(this.playTimeoutId);
      this.playTimeoutId = null;
    }
    this.audioEngine.stop();
  }

  // Get all songs
  getSongs() {
    return this.songs;
  }

  // Get song by ID
  getSongById(songId) {
    return this.songs.find(s => s.id === songId);
  }
}
