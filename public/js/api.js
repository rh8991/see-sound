// API Abstraction Layer - Works with localStorage for GitHub Pages
// Falls back to Express API if available

const API = {
  // Initialize with default data if needed
  init() {
    if (!localStorage.getItem('frequencies-data')) {
      const defaultData = {
        samples: [
          { id: 1, name: 'דו (C)', frequency: 262, category: 'note' },
          { id: 2, name: 'רה (D)', frequency: 294, category: 'note' },
          { id: 3, name: 'מי (E)', frequency: 330, category: 'note' },
          { id: 4, name: 'פה (F)', frequency: 349, category: 'note' },
          { id: 5, name: 'סול (G)', frequency: 392, category: 'note' },
          { id: 6, name: 'לה (A)', frequency: 440, category: 'note' },
          { id: 7, name: 'סי (B)', frequency: 494, category: 'note' },
          { id: 8, name: 'משפחה נמוכה', frequency: 50, category: 'freq' },
          { id: 9, name: 'משפחה בינונית', frequency: 500, category: 'freq' },
          { id: 10, name: 'משפחה גבוהה', frequency: 2000, category: 'freq' }
        ],
        categoryNames: {
          note: 'תווים מוזיקליים',
          freq: 'תדרים מיוחדים'
        }
      };
      localStorage.setItem('frequencies-data', JSON.stringify(defaultData));
    }
  },

  // Get all frequencies
  async getFrequencies() {
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

    // Try to sync with server if available
    try {
      await fetch('/api/frequencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, frequencies })
      });
    } catch (error) {
      // Server not available, that's okay
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

    // Try to sync with server if available
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, categoryNames })
      });
    } catch (error) {
      // Server not available, that's okay
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

    // Try to sync with server if available
    try {
      await fetch('/api/frequencies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name, frequency, category })
      });
    } catch (error) {
      // Server not available, that's okay
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

    // Try to sync with server if available
    try {
      await fetch(`/api/frequencies/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
    } catch (error) {
      // Server not available, that's okay
    }

    return { success: true, message: 'Frequency deleted' };
  }
};

// Initialize API on page load
document.addEventListener('DOMContentLoaded', () => {
  API.init();
});
