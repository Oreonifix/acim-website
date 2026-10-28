import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Sends Firebase's standard reset email. The admin never sees or sets a password.
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export function resetErrorText(e) {
  const map = {
    "auth/too-many-requests": "Too many requests. Wait a few minutes and try again.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/network-request-failed": "Network problem. Check your connection."
  };
  return map[e && e.code] || "Could not send the reset email. Try again.";
}

// Calls the server function. The server re-checks the admin role; this page cannot bypass it.
export async function deleteUser(uid, deleteData) {
  const user = auth && auth.currentUser;
  if (!user) throw new Error("You are signed out. Log in again.");
  const token = await user.getIdToken();
  const res = await fetch("/api/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ uid, deleteData })
  });
  const data = await res.json().catch(() => null);
  if (!data) {
    // Not JSON means our function never answered (not deployed, or it crashed on start).
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);
    throw new Error(local
      ? "Delete only works on the live site. The server function is not available on localhost."
      : "The server function did not respond correctly (HTTP " + res.status + "). Check the Vercel logs.");
  }
  if (!res.ok) throw new Error(data.error || "Could not delete the user.");
  return data;
}

// Two-step confirmation: shows exactly which account, then needs the email typed back.
// Resolves { deleteData } if confirmed, otherwise null.
export function confirmDelete({ name, email, uid }) {
  return new Promise((resolve) => {
    const must = email || "DELETE";
    const dlg = document.createElement("dialog");
    dlg.className = "confirm";
    const body = document.createElement("form");
    body.className = "dbody form";
    body.noValidate = true;
    const add = (tag, text, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; body.append(e); return e; };

    add("h2", "Delete this user?");
    add("p", name, "").style.fontWeight = "600";
    if (email) add("p", email);
    add("p", "User ID: " + uid, "hint");

    const lab = document.createElement("label"); lab.className = "check";
    const box = document.createElement("input"); box.type = "checkbox"; box.checked = true;
    const span = document.createElement("span");
    span.textContent = "Also delete their profile, saved designs and feedback. If you untick this, only the login is removed and the data stays in Firestore.";
    lab.append(box, span); body.append(lab);

    add("p", "This cannot be undone. The user will no longer be able to log in.", "notice");
    const l2 = document.createElement("label");
    l2.append(document.createTextNode("Type " + must + " to confirm"));
    const typed = document.createElement("input"); typed.type = "text"; typed.autocomplete = "off";
    l2.append(typed); body.append(l2);

    const actions = document.createElement("div"); actions.className = "actions";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Cancel";
    const yes = document.createElement("button"); yes.type = "submit"; yes.className = "btn danger"; yes.textContent = "Delete permanently"; yes.disabled = true;
    actions.append(no, yes); body.append(actions);
    dlg.append(body);

    let answer = null;
    typed.addEventListener("input", () => { yes.disabled = typed.value.trim().toLowerCase() !== must.toLowerCase(); });
    no.addEventListener("click", () => dlg.close());
    body.addEventListener("submit", (e) => { e.preventDefault(); if (!yes.disabled) { answer = { deleteData: box.checked }; dlg.close(); } });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(answer); });
    document.body.appendChild(dlg);
    dlg.showModal();
    typed.focus();
  });
}