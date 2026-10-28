import { requireAdmin, db, fmtDate, showError } from "./admin.js";
import { imageSrc } from "./image-src.js";
import {
  collectionGroup, query, orderBy, limit, startAfter, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PAGE = 24;
const $ = (id) => document.getElementById(id);
const items = [];            // { id, uid, data, src }
const owners = new Map();    // user id -> name or email
let lastDoc = null, done = false;

// Everything below builds the page with textContent and DOM nodes, never innerHTML,
// so text submitted by users cannot inject code.
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const ownerLabel = (uid) => owners.get(uid) || uid || "Unknown user";
const designTitle = (it) => it.data.DesignName || "Untitled design";

async function loadOwners(uids) {
  const missing = [...new Set(uids)].filter((u) => u && !owners.has(u));
  await Promise.all(missing.map(async (u) => {
    try {
      const snap = await getDoc(doc(db, "Users", u));
      const d = snap.exists() ? snap.data() : {};
      owners.set(u, d.FullName || d.Email || u);
    } catch (e) { owners.set(u, u); }
  }));
}

function card(it) {
  const c = el("article", "gcard");
  const box = el("button", "gbox");
  box.type = "button";
  box.setAttribute("aria-label", "View " + designTitle(it));
  if (it.src) {
    const img = new Image();
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => box.replaceChildren(el("span", "gph", "Image can't be displayed")));
    img.src = it.src;
    box.append(img);
  } else {
    box.append(el("span", "gph", "No preview saved"));
  }
  box.addEventListener("click", () => openViewer(it));
  const info = el("div", "ginfo");
  info.append(el("strong", "gname", designTitle(it)), el("span", "gmeta", ownerLabel(it.uid)), el("span", "gmeta", fmtDate(it.data.CreatedAt)));
  c.append(box, info);
  return c;
}

function render() {
  const term = $("search").value.trim().toLowerCase();
  const mode = $("filter").value;   // all | yes | no
  const shown = items.filter((it) => {
    if (mode === "yes" && !it.src) return false;
    if (mode === "no" && it.src) return false;
    return !term || [designTitle(it), ownerLabel(it.uid), it.uid].some((v) => String(v).toLowerCase().includes(term));
  });
  const grid = $("grid");
  grid.replaceChildren(...(shown.length ? shown.map(card) : [el("p", "empty", "No designs found.")]));
  $("count").textContent = `${shown.length} shown · ${items.length} loaded${done ? "" : " (more available)"}`;
  $("more").hidden = done;
}

function openViewer(it) {
  $("vTitle").textContent = designTitle(it);
  const zoom = $("zoom"), dl = $("download"), note = $("vNote");
  if (it.src) {
    zoom.src = it.src; zoom.hidden = false; note.hidden = true;
    const name = String(it.data.ImageFileName || "");
    const safe = (/\.(png|jpe?g|webp|gif)$/i.test(name) ? name : designTitle(it) + ".png").replace(/[^\w.\- ]+/g, "_");
    dl.href = it.src; dl.download = safe; dl.hidden = false;
  } else {
    zoom.removeAttribute("src"); zoom.hidden = true;
    dl.removeAttribute("href"); dl.removeAttribute("download"); dl.hidden = true;
    note.textContent = "This design has no saved preview image."; note.hidden = false;
  }
  $("vMeta").replaceChildren(
    ...[["Saved by", ownerLabel(it.uid)], ["User ID", it.uid], ["Saved on", fmtDate(it.data.CreatedAt)],
        ["File name", it.data.ImageFileName || "—"], ["Design ID", it.id]].flatMap(([k, v]) => [el("dt", null, k), el("dd", null, v)])
  );
  $("viewer").showModal();
}

async function loadMore() {
  const btn = $("moreBtn");
  btn.disabled = true;
  try {
    const parts = [collectionGroup(db, "Designs"), orderBy("CreatedAt", "desc")];
    if (lastDoc) parts.push(startAfter(lastDoc));
    parts.push(limit(PAGE));
    const snap = await getDocs(query(...parts));
    const added = snap.docs.map((d) => {
      const data = d.data();
      const raw = data.Thumbnail ?? data.thumbnail ?? data.Image ?? data.image;
      return { id: d.id, uid: data.UserId || d.ref.parent.parent?.id || "", data, src: imageSrc(raw) };
    });
    await loadOwners(added.map((a) => a.uid));
    items.push(...added);
    if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) done = true;
    render();
  } catch (e) { console.error(e); showError($("err"), e); }
  btn.disabled = false;
}

requireAdmin(() => {
  $("search").addEventListener("input", render);
  $("filter").addEventListener("change", render);
  $("moreBtn").addEventListener("click", loadMore);
  $("vClose").addEventListener("click", () => $("viewer").close());
  $("download").addEventListener("click", (e) => { if (!e.currentTarget.getAttribute("href")) e.preventDefault(); });
  $("viewer").addEventListener("close", () => $("zoom").removeAttribute("src"));
  loadMore();
});