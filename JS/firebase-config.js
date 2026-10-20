 // Paste your Firebase web app config here (Firebase console > Project settings > Your apps).
// Use the SAME project as the ACIM Android app so both read and write the same data.
// These values identify the project; they are not secrets. Security comes from the rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAXNgBxr1NGJiLkfFQrlAHWMI-8nmgdsew",
  authDomain: "capstonearproject-9b963.firebaseapp.com",
  projectId: "capstonearproject-9b963",
  storageBucket: "capstonearproject-9b963.firebasestorage.app",
  messagingSenderId: "262093521188",
  appId: "1:262093521188:web:83dc29c849fc622ed533b1"
};

export const isConfigured = !Object.values(firebaseConfig).some((v) => String(v).startsWith("YOUR_"));

const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
