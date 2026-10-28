import { requireAdmin, db, esc, fmtDate, showError } from "./admin.js";
import {
  collection, query, orderBy, limit, startAfter, getDocs, documentId
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openAddUserDialog } from "./add-user.js";

const PAGE = 25;
const $ = (id) => document.getElementById(id);
const rows = [];       // every user loaded so far: { id, data, hasDesign }
let lastDoc = null;    // hasDesign: undefined = still checking, true/false = known, null = check failed
let done = false;

function userName(u) {
  return u.FullName || u.Name || u.name || u.DisplayName || u.displayName || u.Username || u.username || "";
}
function userEmail(u) { return u.Email || u.email || ""; }

function isVerified(u) { return u.EmailVerified === true || u.emailVerified === true; }
function verifiedCell(u) {
  return isVerified(u) ? '<span class="pill yes">Verified</span>' : '<span class="pill no">Not verified</span>';
}

function designCell(r) {
  if (r.hasDesign === undefined) return "…";
  if (r.hasDesign === null) return "—";
  return r.hasDesign ? '<span class="tag" style="margin-left:0">Yes</span>' : "No";
}

function render() {
  const term = $("search").value.trim().toLowerCase();
  const filter = $("filter").value;   // all | yes | no
  const vf = $("fVerified").value;    // all | yes | no

  const shown = rows.filter((r) => {
    if (filter === "yes" && r.hasDesign !== true) return false;
    if (filter === "no" && r.hasDesign !== false) return false;
    if (vf === "yes" && !isVerified(r.data)) return false;
    if (vf === "no" && isVerified(r.data)) return false;
    return !term || [r.id, userName(r.data), userEmail(r.data)].some((v) => String(v).toLowerCase().includes(term));
  });

  $("tbody").innerHTML = shown.length
    ? shown.map((r) => `<tr>
        <td>${esc(userName(r.data) || "—")}</td>
        <td>${esc(userEmail(r.data) || "—")}</td>
        <td>${esc(r.data.CreatedAt ? fmtDate(r.data.CreatedAt) : "—")}</td>
        <td>${designCell(r)}</td>
        <td>${verifiedCell(r.data)}</td>
        <td><button class="btn" data-uid="${esc(r.id)}">View</button></td>
      </tr>`).join("")
    : '<tr><td colspan="6" class="empty">No users found.</td></tr>';

  $("count").textContent = `${shown.length} shown · ${rows.length} loaded${done ? "" : " (more available)"}`;
  $("more").hidden = done;
}

// For each newly loaded user, check whether their Designs subcollection has at least one document.
// Reads only 1 document per user, so it stays cheap.
async function checkDesigns(newRows) {
  await Promise.all(newRows.map(async (r) => {
    try {
      const snap = await getDocs(query(collection(db, "Users", r.id, "Designs"), limit(1)));
      r.hasDesign = !snap.empty;
    } catch (e) {
      console.error("Design check failed for", r.id, e);
      r.hasDesign = null;
    }
  }));
}

async function loadMore() {
  const btn = $("moreBtn");
  btn.disabled = true;
  try {
    const parts = [collection(db, "Users"), orderBy(documentId()), limit(PAGE)];
    if (lastDoc) parts.splice(2, 0, startAfter(lastDoc));
    const snap = await getDocs(query(...parts));
    // skip users already in the table (e.g. one that was just added with "Add user")
    const added = snap.docs
      .filter((d) => !rows.some((r) => r.id === d.id))
      .map((d) => ({ id: d.id, data: d.data(), hasDesign: undefined }));
    rows.push(...added);
    if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) done = true;
    render();                    // show users right away
    await checkDesigns(added);   // then fill in the design column
    render();
  } catch (e) { showError($("err"), e); }
  btn.disabled = false;
}

import { resetPassword, resetErrorText, deleteUser, confirmDelete } from "./user-actions.js";

function flash(text, ok) {
  const box = $("err");
  box.textContent = text;
  box.className = "notice" + (ok ? " ok" : "");
  setTimeout(() => { box.textContent = ""; box.className = ""; }, 8000);
}

async function openUser(uid) {
  const row = rows.find((r) => r.id === uid);
  $("dTitle").textContent = (row && (userName(row.data) || userEmail(row.data))) || uid;
  $("dBody").innerHTML = '<p class="loading">Loading…</p>';
  $("dialog").showModal();
  try {
    const [designs, feedback] = await Promise.all([
      getDocs(collection(db, "Users", uid, "Designs")),
      getDocs(collection(db, "Users", uid, "Feedback"))
    ]);
    const dList = designs.docs.map((d) => d.data());
    const fList = feedback.docs.map((d) => d.data());
    $("dBody").innerHTML = `
      <p class="m">${row ? verifiedCell(row.data) : ""} ${esc(row ? userEmail(row.data) : "")}</p>
      <p class="m">User ID: ${esc(uid)}</p>
      <div class="actions-row">
        <button class="btn" id="uReset" type="button">Send password reset email</button>
        <button class="btn danger" id="uDelete" type="button">Delete user…</button>
      </div>
      <div id="uMsg" role="status"></div>
      <h3>Designs (${dList.length})</h3>
      ${dList.length ? `<ul class="list">${dList.map((x) => `<li>
          <div class="t">${esc(x.DesignName || "Untitled design")}</div>
          <div class="m">${esc(x.ImageFileName || "")} · ${esc(fmtDate(x.CreatedAt))}</div></li>`).join("")}</ul>`
        : '<div class="empty">No designs.</div>'}
      <h3>Feedback (${fList.length})</h3>
      ${fList.length ? `<ul class="list">${fList.map((x) => `<li>
          <div class="t"><span class="stars">${"★".repeat(Math.round(Number(x.Rating) || 0))}</span>
            ${x.Category ? `<span class="tag">${esc(x.Category)}</span>` : ""}
            ${x.Classification ? `<span class="tag">${esc(x.Classification)}</span>` : ""}</div>
          <div class="clamp">${esc(x.Comment || "")}</div>
          <div class="m">${esc(fmtDate(x.CreatedAt))}</div></li>`).join("")}</ul>`
        : '<div class="empty">No feedback.</div>'}`;
    wireActions(uid, row);
  } catch (e) { showError($("dBody"), e); }
}

function wireActions(uid, row) {
  const msg = $("uMsg");
  const say = (text, ok) => { msg.textContent = text; msg.className = "notice" + (ok ? " ok" : ""); };
  const name = row ? (userName(row.data) || userEmail(row.data) || uid) : uid;
  const email = row ? userEmail(row.data) : "";

  $("uReset").addEventListener("click", async (e) => {
    if (!email) return say("This user has no email address on file.");
    if (!window.confirm("Send a password reset email to " + email + "?\n\nThis does not change the password. The user chooses a new one from the email.")) return;
    e.target.disabled = true;
    try { await resetPassword(email); say("If " + email + " has an account, a reset email is on its way.", true); }
    catch (err) { say(resetErrorText(err)); }
    e.target.disabled = false;
  });

  $("uDelete").addEventListener("click", async (e) => {
    const choice = await confirmDelete({ name, email, uid });
    if (!choice) return;
    e.target.disabled = true;
    try {
      const out = await deleteUser(uid, choice.deleteData);
      const i = rows.findIndex((r) => r.id === uid);
      if (i >= 0) rows.splice(i, 1);
      $("dialog").close();
      render();
      flash(name + " was deleted" + (out.dataDeleted ? ", along with their profile, designs and feedback." : ". Their data was kept in Firestore."), true);
    } catch (err) { say(err.message); e.target.disabled = false; }
  });
}

requireAdmin(() => {
  $("search").addEventListener("input", render);
  $("filter").addEventListener("change", render);
  $("fVerified").addEventListener("change", render);
  $("moreBtn").addEventListener("click", loadMore);
  $("tbody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-uid]");
    if (b) openUser(b.dataset.uid);
  });
  $("dClose").addEventListener("click", () => $("dialog").close());

  // Add user: open the dialog, then put the new user at the top of the table
  $("addUserBtn").addEventListener("click", async () => {
    const created = await openAddUserDialog();
    if (!created) return;
    rows.unshift({ id: created.id, data: created.data, hasDesign: false });
    render();
  });

  loadMore();
});