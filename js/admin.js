// Shared admin helpers: role check, sign-out, formatting.
import { auth, db, isConfigured } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export { db };

let stopWatch = null;    // listener that signs this device out if the account logs in elsewhere
let loggingOut = false; // stops the "not signed in" redirect from overriding the logout redirect

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function fmtDate(v) {
  if (!v) return "—";
  let d = v;
  if (typeof v.toDate === "function") d = v.toDate();
  else if (typeof v === "number") d = new Date(v);
  else if (typeof v === "string") d = new Date(v);
  if (!(d instanceof Date) || isNaN(d)) return String(v);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function showError(el, err) {
  const msg = String(err && err.message ? err.message : err);
  // Firestore index errors include a link; make it clickable.
  const html = esc(msg).replace(/(https:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  el.innerHTML = `<div class="notice">${html}</div>`;
}

// Runs onReady(user) only for signed-in accounts whose token has role admin or superAdmin.
export function requireAdmin(onReady) {
  if (!isConfigured || !auth) {
    document.body.innerHTML =
      '<p style="padding:32px;font-family:sans-serif;color:#eee;background:#0b0b0c">Firebase is not configured yet. Fill in <b>js/firebase-config.js</b> with your real project values.</p>';
    return;
  }
  onAuthStateChanged(auth, async (user) => {
    if (!user) { if (!loggingOut) location.replace("admin-login.html"); return; }
    try {
      const token = await user.getIdTokenResult(true);
      const role = token.claims.role;
      if (role !== "admin" && role !== "superAdmin") {
        await signOut(auth);
        location.replace("admin-login.html?reason=norole");
        return;
      }
      const who = document.getElementById("who");
      const shown = user.email.endsWith("@acim.invalid") ? user.email.split("@")[0] : user.email;
      if (who) who.textContent = `${shown} · ${role}`;
      // One device per admin: if another device logs in, this one is signed out
      if (stopWatch) stopWatch();
      stopWatch = onSnapshot(doc(db, "adminSessions", user.uid), async (snap) => {
        if (!snap.exists() || snap.data().sid !== localStorage.getItem("acimSid")) {
          if (stopWatch) stopWatch();
          loggingOut = true;
          await signOut(auth);
          location.replace("admin-login.html?reason=otherdevice");
        }
      }, (err) => console.error("Session check failed:", err));
      onReady(user, role);
    } catch (e) {
      console.error("Admin check failed:", e);
      await signOut(auth);
      location.replace("admin-login.html?reason=error");
    }
  });
}

// Asks "Log out?" in a small dialog. Resolves true only if the person confirms.
function confirmLogout() {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "confirm";
    dlg.setAttribute("aria-labelledby", "cfTitle");
    dlg.innerHTML = `
      <div class="dbody">
        <h2 id="cfTitle">Log out?</h2>
        <p>You will need to sign in again to use the dashboard.</p>
        <div class="actions">
          <button type="button" class="btn" data-no>Stay signed in</button>
          <button type="button" class="btn gold" data-yes>Log out</button>
        </div>
      </div>`;
    let answer = false;
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-yes]")) { answer = true; dlg.close(); }
      else if (e.target.closest("[data-no]") || e.target === dlg) dlg.close();
    });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(answer); });
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector("[data-no]").focus();
  });
}

document.addEventListener("click", async (e) => {
  if (e.target.closest("[data-logout]")) {
    if (!(await confirmLogout())) return;
    loggingOut = true;
    await signOut(auth);
    location.replace("index.html");
  }
});