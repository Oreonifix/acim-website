// js/add-user.js  -  "Add user" for the ACIM admin dashboard
// Creates the Firebase Auth account AND the Firestore Users/{uid} document,
// without logging the admin out.
import { auth, db } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- settings you may want to change -------------------------------------
const SEND_VERIFICATION_EMAIL = true;   // email the new user a verification link
const FIRESTORE_EMAIL_VERIFIED = false; // value saved in Users/{uid}.EmailVerified
// ---------------------------------------------------------------------------

// A second app instance has its own login session, so creating the new
// account there does NOT sign the admin out of the main app.
function secondaryAuth() {
  const app = getApps().find((a) => a.name === "secondary") || initializeApp(auth.app.options, "secondary");
  return getAuth(app);
}

const ERRORS = {
  "auth/email-already-in-use": "That email is already registered.",
  "auth/invalid-email": "That email isn't valid.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/operation-not-allowed": "Email/Password sign-in is turned off (Firebase Console > Authentication > Sign-in method).",
  "permission-denied": "The login was created, but Firestore blocked saving the profile. Check your Firestore rules."
};

export async function addUser({ first, middle, last, suffix, email, password }) {
  const sAuth = secondaryAuth();
  const full = [first, middle, last, suffix].filter(Boolean).join(" ");
  try {
    const cred = await createUserWithEmailAndPassword(sAuth, email, password);
    await updateProfile(cred.user, { displayName: full }).catch(() => {});
    if (SEND_VERIFICATION_EMAIL) await sendEmailVerification(cred.user).catch(() => {});

    // >>> Add any other fields your mobile app expects on a user document <<<
    const data = {
      CreatedAt: serverTimestamp(),
      Email: email,
      EmailVerified: FIRESTORE_EMAIL_VERIFIED,
      FirstName: first,
      FullName: full,
      LastName: last,
      MiddleName: middle,
      Suffix: suffix
    };
    await setDoc(doc(db, "Users", cred.user.uid), data);
    return { id: cred.user.uid, data: { ...data, CreatedAt: new Date() } }; // local copy for the table
  } finally {
    await signOut(sAuth).catch(() => {});   // always drop the temporary session
  }
}

// ---- dialog UI (matches your dashboard.css look) ---------------------------
function injectStyle() {
  if (document.getElementById("addUserStyle")) return;
  const s = document.createElement("style");
  s.id = "addUserStyle";
  s.textContent = `
    dialog.confirm.wide{width:min(520px,92vw)}
    dialog.confirm .row2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
    dialog.confirm .field{display:block;margin:12px 0 0;text-align:left}
    dialog.confirm .field span{display:block;font-size:.85rem;color:var(--mut);margin-bottom:4px}
    dialog.confirm .field input{width:100%;min-height:46px;padding:0 12px;border:1px solid #b9ae93;
      border-radius:10px;font:inherit;background:#fff;color:var(--text)}
    dialog.confirm .err{color:#8a1c10;font-size:.9rem;min-height:20px;margin-top:10px}
    @media(max-width:480px){dialog.confirm .row2{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

// Resolves { id, data } when a user was added, otherwise null.
export function openAddUserDialog() {
  injectStyle();
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "confirm wide";
    dlg.setAttribute("aria-labelledby", "auTitle");
    dlg.innerHTML = `
      <form class="dbody" novalidate>
        <h2 id="auTitle">Add user</h2>
        <p>Creates the login and the user profile. Give the user their temporary password.</p>
        <div class="row2">
          <label class="field"><span>First name *</span><input name="first" autocomplete="off"></label>
          <label class="field"><span>Middle name</span><input name="middle" autocomplete="off"></label>
          <label class="field"><span>Last name *</span><input name="last" autocomplete="off"></label>
          <label class="field"><span>Suffix</span><input name="suffix" autocomplete="off" placeholder="Jr., III…"></label>
        </div>
        <label class="field"><span>Email *</span><input name="email" type="email" autocomplete="off"></label>
        <label class="field"><span>Temporary password * (min. 6 characters)</span><input name="password" type="text" autocomplete="off"></label>
        <div class="err" role="alert"></div>
        <div class="actions">
          <button type="button" class="btn" data-no>Cancel</button>
          <button type="submit" class="btn gold">Add user</button>
        </div>
      </form>`;
    const form = dlg.querySelector("form");
    const err = dlg.querySelector(".err");
    const submit = dlg.querySelector("button[type=submit]");
    let result = null;

    dlg.querySelector("[data-no]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(result); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const v = (n) => String(form.elements[n].value || "").trim();
      const p = { first: v("first"), middle: v("middle"), last: v("last"), suffix: v("suffix"),
                  email: v("email"), password: String(form.elements.password.value || "") };
      if (!p.first || !p.last) { err.textContent = "First and last name are required."; return; }
      if (!p.email) { err.textContent = "Enter an email."; return; }
      if (p.password.length < 6) { err.textContent = ERRORS["auth/weak-password"]; return; }
      submit.disabled = true; submit.textContent = "Adding…";
      try {
        result = await addUser(p);
        dlg.close();
      } catch (ex) {
        err.textContent = ERRORS[ex.code] || ex.message || "Something went wrong.";
        submit.disabled = false; submit.textContent = "Add user";
      }
    });

    document.body.appendChild(dlg);
    dlg.showModal();
    form.elements.first.focus();
  });
}