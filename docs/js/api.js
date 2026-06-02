// API Abstraction Layer - Works with localStorage for GitHub Pages
// Falls back to Express API if available

const API = {
  // Bump this when the data schema changes to force a re-init
  DATA_VERSION: 2,

  // Initialize with default data if needed
  init() {
    const stored = localStorage.getItem('frequencies-data');
    const parsed = stored ? JSON.parse(stored) : null;

    if (!parsed || parsed.version !== this.DATA_VERSION) {
      const defaultData = {
        version: this.DATA_VERSION,
        samples: [
          // Octave 3
          { id: 1,  name: 'דו (C)',  noteSymbol: 'C', octave: 3, frequency: 130.81, category: 'note' },
          { id: 2,  name: 'רה (D)',  noteSymbol: 'D', octave: 3, frequency: 146.83, category: 'note' },
          { id: 3,  name: 'מי (E)',  noteSymbol: 'E', octave: 3, frequency: 164.81, category: 'note' },
          { id: 4,  name: 'פה (F)',  noteSymbol: 'F', octave: 3, frequency: 174.61, category: 'note' },
          { id: 5,  name: 'סול (G)', noteSymbol: 'G', octave: 3, frequency: 196.00, category: 'note' },
          { id: 6,  name: 'לה (A)',  noteSymbol: 'A', octave: 3, frequency: 220.00, category: 'note' },
          { id: 7,  name: 'סי (B)',  noteSymbol: 'B', octave: 3, frequency: 246.94, category: 'note' },
          // Octave 4
          { id: 8,  name: 'דו (C)',  noteSymbol: 'C', octave: 4, frequency: 261.63, category: 'note' },
          { id: 9,  name: 'רה (D)',  noteSymbol: 'D', octave: 4, frequency: 293.66, category: 'note' },
          { id: 10, name: 'מי (E)',  noteSymbol: 'E', octave: 4, frequency: 329.63, category: 'note' },
          { id: 11, name: 'פה (F)',  noteSymbol: 'F', octave: 4, frequency: 349.23, category: 'note' },
          { id: 12, name: 'סול (G)', noteSymbol: 'G', octave: 4, frequency: 392.00, category: 'note' },
          { id: 13, name: 'לה (A)',  noteSymbol: 'A', octave: 4, frequency: 440.00, category: 'note' },
          { id: 14, name: 'סי (B)',  noteSymbol: 'B', octave: 4, frequency: 493.88, category: 'note' },
          // Octave 5
          { id: 15, name: 'דו (C)',  noteSymbol: 'C', octave: 5, frequency: 523.25, category: 'note' },
          { id: 16, name: 'רה (D)',  noteSymbol: 'D', octave: 5, frequency: 587.33, category: 'note' },
          { id: 17, name: 'מי (E)',  noteSymbol: 'E', octave: 5, frequency: 659.25, category: 'note' },
          { id: 18, name: 'פה (F)',  noteSymbol: 'F', octave: 5, frequency: 698.46, category: 'note' },
          { id: 19, name: 'סול (G)', noteSymbol: 'G', octave: 5, frequency: 783.99, category: 'note' },
          { id: 20, name: 'לה (A)',  noteSymbol: 'A', octave: 5, frequency: 880.00, category: 'note' },
          { id: 21, name: 'סי (B)',  noteSymbol: 'B', octave: 5, frequency: 987.77, category: 'note' },
          // Special frequencies
          { id: 22, name: 'בס עמוק',  frequency: 50,   category: 'freq' },
          { id: 23, name: 'A440',      frequency: 440,  category: 'freq' },
          { id: 24, name: 'תדר גבוה', frequency: 2000, category: 'freq' }
        ],
        categoryNames: {
          note: 'תווים מוזיקליים',
          freq: 'תדרים מיוחדים'
        }
      };
      localStorage.setItem('frequencies-data', JSON.stringify(defaultData));
    }
  },

  // Returns true when running on a static host (GitHub Pages, file://, etc.)
  isStaticHost() {
    const { hostname } = window.location;
    return hostname.endsWith('github.io') || hostname === 'localhost' && window.location.pathname.startsWith('/docs');
  },

  // Get all frequencies
  async getFrequencies() {
    if (!this.isStaticHost()) {
      try {
        // Try to fetch from server first (if Express backend is running)
        const response = await Promise.race([
          fetch('/api/frequencies', { method: 'GET', signal: AbortSignal.timeout(1000) }),
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 1100))
        ]);

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        // Server not available, use localStorage
      }
    }

    // Use localStorage
    const data = localStorage.getItem('frequencies-data');
    if (data) {
      return JSON.parse(data);
    }
    
    // Fallback: initialize and return default
    this.init();
    return JSON.parse(localStorage.getItem('frequencies-data'));
  },

  // Update frequencies (protected with password)
  async updateFrequencies(password, frequencies) {
    if (password !== 'admin123') {
      throw new Error('Invalid password');
    }

    const data = JSON.parse(localStorage.getItem('frequencies-data') || '{}');
    data.samples = frequencies;
    localStorage.setItem('frequencies-data', JSON.stringify(data));

    if (!this.isStaticHost()) {
      try {
        await fetch('/api/frequencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, frequencies })
        });
      } catch (error) {
        // Server not available, that's okay
      }
    }

    return { success: true, message: 'Frequencies updated' };
  },

  // Update categories
  async updateCategories(password, categoryNames) {
    if (password !== 'admin123') {
      throw new Error('Invalid password');
    }

    const data = JSON.parse(localStorage.getItem('frequencies-data') || '{}');
    data.categoryNames = categoryNames;
    localStorage.setItem('frequencies-data', JSON.stringify(data));

    if (!this.isStaticHost()) {
      try {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, categoryNames })
        });
      } catch (error) {
        // Server not available, that's okay
      }
    }

    return { success: true, message: 'Categories updated' };
  },

  // Add new frequency
  async addFrequency(password, name, frequency, category) {
    if (password !== 'admin123') {
      throw new Error('Invalid password');
    }

    const data = JSON.parse(localStorage.getItem('frequencies-data') || '{}');
    const newId = Math.max(...data.samples.map(s => s.id), 0) + 1;
    
    data.samples.push({
      id: newId,
      name,
      frequency: parseFloat(frequency),
      category
    });
    
    localStorage.setItem('frequencies-data', JSON.stringify(data));

    if (!this.isStaticHost()) {
      try {
        await fetch('/api/frequencies/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, name, frequency, category })
        });
      } catch (error) {
        // Server not available, that's okay
      }
    }

    return { success: true, message: 'Frequency added' };
  },

  // Delete frequency
  async deleteFrequency(password, id) {
    if (password !== 'admin123') {
      throw new Error('Invalid password');
    }

    const data = JSON.parse(localStorage.getItem('frequencies-data') || '{}');
    data.samples = data.samples.filter(s => s.id !== parseInt(id));
    localStorage.setItem('frequencies-data', JSON.stringify(data));

    if (!this.isStaticHost()) {
      try {
        await fetch(`/api/frequencies/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
      } catch (error) {
        // Server not available, that's okay
      }
    }

    return { success: true, message: 'Frequency deleted' };
  }
};

// Initialize API on page load
document.addEventListener('DOMContentLoaded', () => {
  API.init();
});
