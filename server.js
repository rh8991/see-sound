const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Absolute path to the web root, so everything works no matter which
// directory the server was started from.
const docsDir = path.join(__dirname, "docs");

// ── HTML page routes ──────────────────────────────────────────────────────
// Registered BEFORE express.static so every page is served by this handler
// (with no-store headers) rather than as a cacheable static file. This keeps
// links between pages consistent and stops a stale browser/proxy cache from
// showing the intro page for every route.
//
//   file            served at
//   intro.html      /            /intro       /intro.html
//   index.html      /lab         /index       /index.html
//   simon.html      /simon       /simon.html
//   spectrum.html   /spectrum    /spectrum.html
//   manager.html    /manager     /manager.html
const pageFiles = ["intro", "index", "simon", "spectrum", "manager"];

const sendPage = (file) => (req, res) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  res.sendFile(path.join(docsDir, `${file}.html`), {
    etag: false,
    lastModified: false,
  });
};

// "/" is the intro/landing page; "/lab" is a friendly alias for index.html
app.get("/", sendPage("intro"));
app.get("/lab", sendPage("index"));

pageFiles.forEach((file) => {
  app.get(`/${file}`, sendPage(file)); // e.g. /simon
  app.get(`/${file}.html`, sendPage(file)); // e.g. /simon.html
});

// Static assets (css, js, images, data). index:false so "/" stays with the
// route above.
app.use(express.static(docsDir, { index: false }));

// Data file path
const dataDir = path.join(__dirname, "docs/data");
const frequenciesFile = path.join(dataDir, "frequencies.json");

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize default frequencies if file doesn't exist
if (!fs.existsSync(frequenciesFile)) {
  const defaultFrequencies = {
    samples: [
      { id: 1, name: "דו (C)", frequency: 262, category: "note" },
      { id: 2, name: "רה (D)", frequency: 294, category: "note" },
      { id: 3, name: "מי (E)", frequency: 330, category: "note" },
      { id: 4, name: "פה (F)", frequency: 349, category: "note" },
      { id: 5, name: "סול (G)", frequency: 392, category: "note" },
      { id: 6, name: "לה (A)", frequency: 440, category: "note" },
      { id: 7, name: "סי (B)", frequency: 494, category: "note" },
      { id: 8, name: "משפחה נמוכה", frequency: 50, category: "freq" },
      { id: 9, name: "משפחה בינונית", frequency: 500, category: "freq" },
      { id: 10, name: "משפחה גבוהה", frequency: 2000, category: "freq" },
    ],
    categoryNames: {
      note: "תווים מוזיקליים",
      freq: "תדרים מיוחדים",
    },
  };
  fs.writeFileSync(
    frequenciesFile,
    JSON.stringify(defaultFrequencies, null, 2),
  );
}

// ── API routes ───────────────────────────────────────────────────────────

// Get all frequencies
app.get("/api/frequencies", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(frequenciesFile, "utf-8"));
    res.json(data);
  } catch (error) {
    console.error(
      "GET /api/frequencies error:",
      error.message,
      "| path:",
      frequenciesFile,
    );
    res
      .status(500)
      .json({
        error: "Failed to read frequencies",
        detail: error.message,
        path: frequenciesFile,
      });
  }
});

// Update frequencies (protected with password)
app.post("/api/frequencies", (req, res) => {
  const { password, frequencies } = req.body;
  const MANAGER_PASSWORD = "admin123"; // Change this to a secure password

  if (password !== MANAGER_PASSWORD) {
    return res.status(403).json({ error: "Invalid password" });
  }

  try {
    const data = JSON.parse(fs.readFileSync(frequenciesFile, "utf-8"));
    data.samples = frequencies;
    fs.writeFileSync(frequenciesFile, JSON.stringify(data, null, 2));
    res.json({ success: true, message: "Frequencies updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update frequencies" });
  }
});

// Update frequency categories
app.post("/api/categories", (req, res) => {
  const { password, categoryNames } = req.body;
  const MANAGER_PASSWORD = "admin123";

  if (password !== MANAGER_PASSWORD) {
    return res.status(403).json({ error: "Invalid password" });
  }

  try {
    const data = JSON.parse(fs.readFileSync(frequenciesFile, "utf-8"));
    data.categoryNames = categoryNames;
    fs.writeFileSync(frequenciesFile, JSON.stringify(data, null, 2));
    res.json({ success: true, message: "Categories updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update categories" });
  }
});

// Add new frequency
app.post("/api/frequencies/add", (req, res) => {
  const { password, name, frequency, category } = req.body;
  const MANAGER_PASSWORD = "admin123";

  if (password !== MANAGER_PASSWORD) {
    return res.status(403).json({ error: "Invalid password" });
  }

  try {
    const data = JSON.parse(fs.readFileSync(frequenciesFile, "utf-8"));
    const newId = Math.max(...data.samples.map((s) => s.id), 0) + 1;
    data.samples.push({
      id: newId,
      name,
      frequency: parseFloat(frequency),
      category,
    });
    fs.writeFileSync(frequenciesFile, JSON.stringify(data, null, 2));
    res.json({ success: true, message: "Frequency added successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to add frequency" });
  }
});

// Delete frequency
app.delete("/api/frequencies/:id", (req, res) => {
  const { id } = req.params;
  const password = req.body.password;
  const MANAGER_PASSWORD = "admin123";

  if (password !== MANAGER_PASSWORD) {
    return res.status(403).json({ error: "Invalid password" });
  }

  try {
    const data = JSON.parse(fs.readFileSync(frequenciesFile, "utf-8"));
    data.samples = data.samples.filter((s) => s.id !== parseInt(id));
    fs.writeFileSync(frequenciesFile, JSON.stringify(data, null, 2));
    res.json({ success: true, message: "Frequency deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete frequency" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 See-Sound app running at http://localhost:${PORT}`);
  console.log(`📖 Intro / landing:   http://localhost:${PORT}/`);
  console.log(`📚 Student lab:        http://localhost:${PORT}/lab`);
  console.log(`🎹 Simon game:        http://localhost:${PORT}/simon`);
  console.log(`🎤 Spectrometer:      http://localhost:${PORT}/spectrum`);
  console.log(`⚙️  Manager panel:     http://localhost:${PORT}/manager`);
  console.log(`🔐 Default password: admin123 (change this!)`);
});
