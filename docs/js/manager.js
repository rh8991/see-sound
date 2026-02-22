// Manager Panel - Admin Interface

class ManagerPanel {
  constructor() {
    this.isLoggedIn = false;
    this.currentPassword = null;
    this.frequencies = [];
    this.categories = {};
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Login
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => this.handleLogin(e));
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => this.handleLogout(e));
    }

    // Add frequency form
    const addFreqForm = document.getElementById('addFrequencyForm');
    if (addFreqForm) {
      addFreqForm.addEventListener('submit', (e) => this.handleAddFrequency(e));
    }

    // Categories form
    const categoriesForm = document.getElementById('categoriesForm');
    if (categoriesForm) {
      categoriesForm.addEventListener('submit', (e) => this.handleUpdateCategories(e));
    }

    // Allow Enter key on password input
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleLogin(e);
        }
      });
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput.value.trim();
    const loginError = document.getElementById('loginError');

    if (!password) {
      loginError.textContent = 'אנא הזן סיסמה';
      return;
    }

    try {
      // Try to load frequencies to verify password
      const data = await API.getFrequencies();
      
      this.currentPassword = password;
      this.frequencies = data.samples;
      this.categories = data.categoryNames;

      this.isLoggedIn = true;
      this.showDashboard();
      loginError.textContent = '';
      passwordInput.value = '';
    } catch (error) {
      loginError.textContent = 'שגיאה בטעינת הנתונים';
      console.error('Login error:', error);
    }
  }

  handleLogout(e) {
    e.preventDefault();
    this.isLoggedIn = false;
    this.currentPassword = null;
    this.hideDashboard();
    document.getElementById('passwordInput').value = '';
    document.getElementById('loginError').textContent = '';
  }

  showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    this.loadFrequencies();
    this.loadCategories();
  }

  hideDashboard() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
  }

  async loadFrequencies() {
    try {
      const data = await API.getFrequencies();
      this.frequencies = data.samples;
      this.renderFrequencies();
    } catch (error) {
      console.error('Failed to load frequencies:', error);
    }
  }

  renderFrequencies() {
    const container = document.getElementById('samplesListContainer');
    container.innerHTML = '';

    if (this.frequencies.length === 0) {
      container.innerHTML = '<p>אין תדרים זמינים</p>';
      return;
    }

    this.frequencies.forEach(freq => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'sample-item';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'sample-info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'sample-name';
      nameDiv.textContent = freq.name;

      const freqDiv = document.createElement('div');
      freqDiv.className = 'sample-freq';
      freqDiv.textContent = `${freq.frequency} Hz - ${freq.category}`;

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(freqDiv);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'sample-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-edit';
      editBtn.textContent = '✏️ ערוך';
      editBtn.addEventListener('click', () => this.editFrequency(freq));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-delete';
      deleteBtn.textContent = '🗑️ מחק';
      deleteBtn.addEventListener('click', () => this.deleteFrequency(freq.id));

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);

      itemDiv.appendChild(infoDiv);
      itemDiv.appendChild(actionsDiv);

      container.appendChild(itemDiv);
    });
  }

  editFrequency(freq) {
    const newName = prompt('שם חדש:', freq.name);
    if (newName === null) return;

    const newFreqValue = prompt('ערך תדר חדש (Hz):', freq.frequency);
    if (newFreqValue === null) return;

    // Update in array
    freq.name = newName;
    freq.frequency = parseFloat(newFreqValue);

    // Save to server
    this.saveFrequencies();
  }

  async deleteFrequency(id) {
    if (!confirm('האם אתה בטוח שברצונך למחוק תדר זה?')) {
      return;
    }

    try {
      const data = await API.deleteFrequency(this.currentPassword, id);
      if (data.success) {
        this.loadFrequencies();
      } else {
        alert('שגיאה: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to delete frequency:', error);
      alert('שגיאה בעת מחיקת התדר: ' + error.message);
    }
  }

  async saveFrequencies() {
    try {
      const data = await API.updateFrequencies(this.currentPassword, this.frequencies);
      if (data.success) {
        this.showMessage('סדרים עודכנו בהצלחה', 'success');
        this.loadFrequencies();
      } else {
        this.showMessage('שגיאה: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Failed to save frequencies:', error);
      this.showMessage('שגיאה בעת שמירת הנתונים', 'error');
    }
  }

  async handleAddFrequency(e) {
    e.preventDefault();

    const name = document.getElementById('newFreqName').value.trim();
    const frequency = document.getElementById('newFreqValue').value.trim();
    const category = document.getElementById('newFreqCategory').value.trim();

    if (!name || !frequency || !category) {
      this.showMessage('אנא מלא את כל השדות', 'error', 'addFreqMessage');
      return;
    }

    try {
      const data = await API.addFrequency(this.currentPassword, name, frequency, category);
      if (data.success) {
        this.showMessage('תדר נוסף בהצלחה', 'success', 'addFreqMessage');
        document.getElementById('addFrequencyForm').reset();
        this.loadFrequencies();
      } else {
        this.showMessage('שגיאה: ' + data.error, 'error', 'addFreqMessage');
      }
    } catch (error) {
      console.error('Failed to add frequency:', error);
      this.showMessage('שגיאה בעת הוספת התדר: ' + error.message, 'error', 'addFreqMessage');
    }
  }

  async loadCategories() {
    try {
      const data = await API.getFrequencies();
      this.categories = data.categoryNames;
      this.renderCategories();
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  renderCategories() {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';

    Object.keys(this.categories).forEach(key => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'category-item';

      const label = document.createElement('label');
      label.htmlFor = `cat-${key}`;
      label.textContent = `קטגוריה: ${key}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.id = `cat-${key}`;
      input.value = this.categories[key];
      input.addEventListener('change', (e) => {
        this.categories[key] = e.target.value;
      });

      itemDiv.appendChild(label);
      itemDiv.appendChild(input);
      container.appendChild(itemDiv);
    });
  }

  async handleUpdateCategories(e) {
    e.preventDefault();

    try {
      const data = await API.updateCategories(this.currentPassword, this.categories);
      if (data.success) {
        this.showMessage('קטגוריות עודכנו בהצלחה', 'success', 'categoriesMessage');
      } else {
        this.showMessage('שגיאה: ' + data.error, 'error', 'categoriesMessage');
      }
    } catch (error) {
      console.error('Failed to update categories:', error);
      this.showMessage('שגיאה בעת עדכון הקטגוריות: ' + error.message, 'error', 'categoriesMessage');
    }
  }

  showMessage(text, type, elementId = null) {
    const element = elementId ? document.getElementById(elementId) : null;
    if (element) {
      element.textContent = text;
      element.className = `message ${type}`;
      setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
      }, 3000);
    }
  }
}

// Initialize manager panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const manager = new ManagerPanel();
});
