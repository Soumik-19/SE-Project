/**
 * firebase-config.js
 * ──────────────────
 * Firebase client SDK initialisation.
 * Exports: app, auth, db
 *
 * HOW TO CONFIGURE:
 *   1. Go to https://console.firebase.google.com
 *   2. Your project → Project Settings → General → "Your apps" → Web app
 *   3. Copy the firebaseConfig object values below.
 *
 * PLACEMENT: frontend/js/firebase-config.js
 * IMPORTED BY: auth.js, app.js, and every page module via ES module import
 */

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth,
         setPersistence,
         browserLocalPersistence }
                             from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Replace these values with your Firebase project's config ──────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── Initialise ────────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Session persists across browser tabs and refreshes (stored in localStorage)
setPersistence(auth, browserLocalPersistence);

export { app, auth, db };
