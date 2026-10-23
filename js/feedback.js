import { requireAdmin, db, esc, fmtDate, showError } from "./admin.js";
import {
  collectionGroup, query, orderBy, limit, startAfter, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PAGE = 25;
const $ = (id) => document.getElementById(id);
const rows = [];
let lastDoc = null;
let done = false;

function stars(n) {
  const r = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return `<span class="stars" title="${r} / 5">${"★".repeat(r)}${"☆".repeat(5 - r)}</span>`;
}

// Fill a dropdown with the distinct values found so far, keeping the current choice.
function syncOptions(selectId, field, allLabel) {
  const sel = $(selectId);
  const current = sel.value;
  const values = [...new Set(rows.map((r) => r.data[field]).filter(Boolean))].sort();
  sel.innerHTML = `<option value="all">${allLabel}</option>` +
    values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  sel.value = values.includes(current) ? current : "all";
}

function render() {
  const term = $("search").value.trim().toLowerCase();
  const rating = $("fRating").value;
  const cat = $("fCategory").value;
  const cls = $("fClass").value;

  const shown = rows.filter(({ data: x }) => {
    if (rating !== "all" && Math.round(Number(x.Rating) || 0) !== Number(rating)) return false;
    if (cat !== "all" && x.Category !== cat) return false;
    if (cls !== "all" && x.Classification !== cls) return false;
    if (term && ![x.Comment, x.UserEmail].some((v) => String(v || "").toLowerCase().includes(term))) return false;
    return true;
  });

  $("tbody").innerHTML = shown.length
    ? shown.map(({ data: x }) => `<tr>
        <td>${stars(x.Rating)}</td>
        <td>${esc(x.Category || "—")}${x.Classification ? `<br><span class="tag" style="margin-left:0">${esc(x.Classification)}</span>` : ""}</td>
        <td class="comment"><div class="clamp">${esc(x.Comment || "—")}</div></td>
        <td>${esc(x.UserEmail || "—")}</td>
        <td>${esc(fmtDate(x.CreatedAt))}</td>
      </tr>`).join("")
    : '<tr><td colspan="5" class="empty">No feedback found.</td></tr>';

  $("count").textContent = `${shown.length} shown · ${rows.length} loaded${done ? "" : " (more available)"}`;
  $("more").hidden = done;
}

async function loadMore() {
  const btn = $("moreBtn");
  btn.disabled = true;
  try {
    const parts = [collectionGroup(db, "Feedback"), orderBy("CreatedAt", "desc")];
    if (lastDoc) parts.push(startAfter(lastDoc));
    parts.push(limit(PAGE));
    const snap = await getDocs(query(...parts));
    snap.docs.forEach((d) => rows.push({ id: d.id, data: d.data() }));
    if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) done = true;
    syncOptions("fCategory", "Category", "All categories");
    syncOptions("fClass", "Classification", "All classifications");
    render();
  } catch (e) { showError($("err"), e); }
  btn.disabled = false;
}

requireAdmin(() => {
  ["search", "fRating", "fCategory", "fClass"].forEach((id) => {
    $(id).addEventListener(id === "search" ? "input" : "change", render);
  });
  $("moreBtn").addEventListener("click", loadMore);
  loadMore();
});