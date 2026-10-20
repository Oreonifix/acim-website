import { auth, isConfigured } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const ADMIN_ROLES = ["admin", "superAdmin"];

// Role comes from a custom claim set by a trusted server (see setup docs).
// This client check only controls the UI; Firestore/Storage rules enforce access.
async function readRole(user, forceRefresh = false) {
  const token = await user.getIdTokenResult(forceRefresh);
  return token.claims.role || null;
}

export async function loginAdmin(email, password) {
  if (!isConfigured) throw new Error("Firebase is not configured yet. Add your config in js/firebase-config.js.");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const role = await readRole(cred.user, true);
  if (!ADMIN_ROLES.includes(role)) {
    await signOut(auth);
    throw new Error("This account does not have administrator access.");
  }
  return { user: cred.user, role };
}

export function logout() {
  return signOut(auth).then(() => { window.location.href = "admin-login.html"; });
}

// Call at the top of every protected page. Resolves with { user, role } or redirects.
// allowedRoles: e.g. ["superAdmin"] for pages only a Super Admin may open.
export function requireAdmin(allowedRoles = ADMIN_ROLES) {
  return new Promise((resolve) => {
    if (!isConfigured) { window.location.replace("admin-login.html"); return; }
    onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.replace("admin-login.html"); return; }
      const role = await readRole(user);
      if (!allowedRoles.includes(role)) {
        await signOut(auth);
        window.location.replace("admin-login.html?denied=1");
        return;
      }
      resolve({ user, role });
    });
  });
}

export function redirectIfSignedInAdmin() {
  if (!isConfigured) return;
  onAuthStateChanged(auth, async (user) => {
    if (user && ADMIN_ROLES.includes(await readRole(user))) window.location.replace("admin-dashboard.html");
  });
}

export function friendlyAuthError(err) {
  const map = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Network problem. Check your connection and try again."
  };
  return map[err.code] || err.message || "Sign-in failed. Try again.";
}
