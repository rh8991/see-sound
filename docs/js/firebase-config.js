// ====================================================
// Firebase Configuration — Simon Game Leaderboard
// ====================================================
// Setup steps:
// 1. Go to https://console.firebase.google.com/
// 2. Create a project → Add a Web App → copy the config object below
// 3. In the Firebase console go to Build → Firestore Database → Create database
//    (choose "Start in test mode" for quick setup)
// 4. Replace every "YOUR_..." placeholder below with your real values
// ====================================================

const firebaseConfig = {
  apiKey:            'AIzaSyAIRlcElpUsKfuImobIcumB9xe9SmPKfWI',
  authDomain:        'see-sound-f72f6.firebaseapp.com',
  projectId:         'see-sound-f72f6',
  storageBucket:     'see-sound-f72f6.appspot.com',
  messagingSenderId: '1050640912184',
  appId:             '1:1050640912184:web:0b0b1b6c1f1c1f1c1f1c1f',
};

(function () {
  if (typeof firebase === 'undefined') {
    window.simonDB = null;
    return;
  }
  if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
    console.warn('[Simon] Firebase not configured — fill in docs/js/firebase-config.js');
    window.simonDB = null;
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.simonDB = firebase.firestore();
  } catch (e) {
    console.error('[Simon] Firebase init error:', e);
    window.simonDB = null;
  }
})();