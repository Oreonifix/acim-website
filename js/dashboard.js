import { requireAdmin, db, esc, fmtDate, showError } from "./admin.js";
import {
  collection, collectionGroup, query, orderBy, limit, getDocs,
  getCountFromServer, getAggregateFromServer, average
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

async function count(q, el) {
  try {
    const snap = await getCountFromServer(q);
    el.textContent = snap.data().count;
  } catch (e) { el.textContent = "—"; throw e; }
}

function stars(n) {
  const r = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return `<span class="stars">${"★".repeat(r)}${"☆".repeat(5 - r)}</span>`;
}

function fill(el, items, render) {
  el.innerHTML = items.length
    ? `<ul class="list">${items.map(render).join("")}</ul>`
    : '<div class="empty">Nothing here yet.</div>';
}

async function section(id, task) {
  const el = $(id);
  try { await task(el); } catch (e) { showError(el, e); }
}

requireAdmin(() => {
  // Totals
  section("errTotals", async (el) => {
    const results = await Promise.allSettled([
      count(collection(db, "Users"), $("sUsers")),
      count(collectionGroup(db, "Feedback"), $("sFeedback")),
      // Users who created at least one design (counts each user once)
      getDocs(collectionGroup(db, "Designs")).then((snap) => {
        const owners = new Set();
        snap.docs.forEach((d) => owners.add(d.ref.parent.parent ? d.ref.parent.parent.id : d.data().UserId));
        $("sDesignUsers").textContent = owners.size;
      }),
      getAggregateFromServer(collectionGroup(db, "Feedback"), { avg: average("Rating") }).then((s) => {
        const a = s.data().avg;
        $("sRating").textContent = a == null ? "—" : a.toFixed(1) + " / 5";
      })
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) showError(el, failed.reason);
  });

  // Latest users
  section("latestUsers", async (el) => {
    let snap;
    try {
      snap = await getDocs(query(collection(db, "Users"), orderBy("CreatedAt", "desc"), limit(5)));
      if (snap.empty) throw new Error("no CreatedAt");
    } catch {
      snap = await getDocs(query(collection(db, "Users"), limit(5)));
    }
    fill(el, snap.docs, (d) => {
      const u = d.data();
      const name = u.Name || u.name || u.DisplayName || u.displayName || u.Username || u.username || "";
      const email = u.Email || u.email || "";
      return `<li><div class="t">${esc(name || email || d.id)}</div>
        <div class="m">${esc(email && name ? email : "")} ${u.CreatedAt ? "· " + esc(fmtDate(u.CreatedAt)) : ""}</div></li>`;
    });
  });

  // Latest feedback
  section("latestFeedback", async (el) => {
    const snap = await getDocs(query(collectionGroup(db, "Feedback"), orderBy("CreatedAt", "desc"), limit(5)));
    fill(el, snap.docs, (d) => {
      const x = d.data();
      return `<li><div class="t">${stars(x.Rating)}
          ${x.Category ? `<span class="tag">${esc(x.Category)}</span>` : ""}
          ${x.Classification ? `<span class="tag">${esc(x.Classification)}</span>` : ""}</div>
        <div>${esc(x.Comment || "")}</div>
        <div class="m">${esc(x.UserEmail || "")} · ${esc(fmtDate(x.CreatedAt))}</div></li>`;
    });
  });
});