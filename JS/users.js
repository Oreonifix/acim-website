import { requireAdmin, db, esc, fmtDate, showError } from "./admin.js";
import {
  collection, query, orderBy, limit, startAfter, getDocs, documentId
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PAGE = 25;
const $ = (id) => document.getElementById(id);
const rows = [];       // every user loaded so far
let lastDoc = null;
let done = false;

function userName(u) {
  return u.Name || u.name || u.DisplayName || u.displayName || u.Username || u.username || "";
}
function userEmail(u) { return u.Email || u.email || ""; }

function render() {
  const term = $("search").value.trim().toLowerCase();
  const shown = rows.filter((r) =>
    !term || [r.id, userName(r.data), userEmail(r.data)].some((v) => String(v).toLowerCase().includes(term))
  );
  $("tbody").innerHTML = shown.length
    ? shown.map((r) => `<tr>
        <td>${esc(userName(r.data) || "—")}</td>
        <td>${esc(userEmail(r.data) || "—")}</td>
        <td>${esc(r.data.CreatedAt ? fmtDate(r.data.CreatedAt) : "—")}</td>
        <td><button class="btn" data-uid="${esc(r.id)}">View</button></td>
      </tr>`).join("")
    : '<tr><td colspan="4" class="empty">No users found.</td></tr>';
  $("count").textContent = `${rows.length} loaded${done ? "" : " (more available)"}`;
  $("more").hidden = done;
}

async function loadMore() {
  const btn = $("moreBtn");
  btn.disabled = true;
  try {
    const parts = [collection(db, "Users"), orderBy(documentId()), limit(PAGE)];
    if (lastDoc) parts.splice(2, 0, startAfter(lastDoc));
    const snap = await getDocs(query(...parts));
    snap.docs.forEach((d) => rows.push({ id: d.id, data: d.data() }));
    if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) done = true;
    render();
  } catch (e) { showError($("err"), e); }
  btn.disabled = false;
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
      <p class="m" style="color:var(--muted);font-size:13px;word-break:break-all">User ID: ${esc(uid)}</p>
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
          <div>${esc(x.Comment || "")}</div>
          <div class="m">${esc(fmtDate(x.CreatedAt))}</div></li>`).join("")}</ul>`
        : '<div class="empty">No feedback.</div>'}`;
  } catch (e) { showError($("dBody"), e); }
}

requireAdmin(() => {
  $("search").addEventListener("input", render);
  $("moreBtn").addEventListener("click", loadMore);
  $("tbody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-uid]");
    if (b) openUser(b.dataset.uid);
  });
  $("dClose").addEventListener("click", () => $("dialog").close());
  loadMore();
});