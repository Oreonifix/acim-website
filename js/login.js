import { auth, isConfigured } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  getMultiFactorResolver, TotpMultiFactorGenerator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (id) => document.getElementById(id);
const form = $("loginForm"), mfaForm = $("mfaForm"), msg = $("msg");
const DASHBOARD = "admin-dashboard.html";

let resolver = null;   // set when the account needs a second step
let totpHint = null;

function show(text, type = "error") {
  msg.hidden = false;
  msg.className = "msg " + type;
  msg.textContent = text;
}
function busy(button, on, idle) {
  button.disabled = on;
  button.querySelector(".spin").hidden = !on;
  button.querySelector(".label").textContent = on ? "Please wait…" : idle;
}
function isAdmin(token) {
  const r = token.claims.role;
  return r === "admin" || r === "superAdmin";
}

const FRIENDLY = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email address is not valid.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network problem. Check your connection.",
  "auth/operation-not-allowed": "Email/password sign-in is turned off in Firebase (Authentication > Sign-in method).",
  "auth/invalid-api-key": "The API key in js/firebase-config.js is wrong.",
  "auth/invalid-verification-code": "That code is not correct or has expired. Enter the current 6-digit code.",
  "auth/code-expired": "That code has expired. Enter the current 6-digit code."
};

// Check the role, then go to the dashboard. Used after both login steps.
async function finish(user) {
  const token = await user.getIdTokenResult(true);
  if (!isAdmin(token)) {
    await signOut(auth);
    show("This account is not authorized for the dashboard. (Signed in, but no admin role was found on it.)");
    return false;
  }
  location.replace(DASHBOARD);
  return true;
}

if (!isConfigured || !auth) {
  show("Firebase is not configured. Fill in js/firebase-config.js with your real project values.");
  $("submitBtn").disabled = true;
} else {
  // Already signed in as an admin? Go straight to the dashboard.
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const token = await user.getIdTokenResult();
      if (isAdmin(token)) location.replace(DASHBOARD);
    } catch (e) { /* ignore */ }
  });
}

// Why the dashboard sent you back here.
const reason = new URLSearchParams(location.search).get("reason");
if (reason === "norole") {
  show("You were signed in, but this account has no admin role. Run set-admin.js for this exact email, then log in again.");
} else if (reason === "error") {
  show("The dashboard could not verify your role. Open the browser console (F12) for details.");
} else if (reason === "mfa-on") {
  show("Two-step verification is now on. Log in again and enter the code from your authenticator app.", "info");
} else if (reason === "relogin") {
  show("Please log in again to continue.", "info");
}

// Step 1: email and password
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) { show("Enter your email and password."); return; }

  const btn = $("submitBtn");
  busy(btn, true, "Log in");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!(await finish(cred.user))) busy(btn, false, "Log in");
  } catch (err) {
    if (err.code === "auth/multi-factor-auth-required") {
      resolver = getMultiFactorResolver(auth, err);
      totpHint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!totpHint) {
        show("This account uses a second step that this page does not support.");
        busy(btn, false, "Log in");
        return;
      }
      // Switch to the code step
      form.hidden = true;
      mfaForm.hidden = false;
      $("code").focus();
      busy(btn, false, "Log in");
      return;
    }
    console.error(err);
    show(FRIENDLY[err.code] || `Sign-in failed: ${err.code || err.message}`);
    busy(btn, false, "Log in");
  }
});

// Step 2: 6-digit code from the authenticator app
mfaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const code = $("code").value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) { show("Enter the 6-digit code from your authenticator app."); return; }

  const btn = $("mfaBtn");
  busy(btn, true, "Verify");
  try {
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code);
    const cred = await resolver.resolveSignIn(assertion);
    if (!(await finish(cred.user))) busy(btn, false, "Verify");
  } catch (err) {
    console.error(err);
    show(FRIENDLY[err.code] || `Verification failed: ${err.code || err.message}`);
    busy(btn, false, "Verify");
    $("code").select();
  }
});