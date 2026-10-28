// Vercel serverless function: an admin deletes an APP USER.
// Needs the FIREBASE_SERVICE_ACCOUNT environment variable in Vercel (the whole key JSON).
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const ADMIN_ROLES = ["admin", "superAdmin"];
const UID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

// Best-effort limit per admin: 10 deletions a minute. (Serverless instances do not share memory,
// so this slows abuse but is not a hard guarantee.)
const hits = new Map();
function tooMany(uid) {
  const now = Date.now();
  const recent = (hits.get(uid) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(uid, recent);
  return recent.length > 10;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  try {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m) return res.status(401).json({ error: "You are not signed in." });

    let caller;
    try { caller = await getAuth().verifyIdToken(m[1], true); }
    catch { return res.status(401).json({ error: "Your session expired. Log in again." }); }
    if (!ADMIN_ROLES.includes(caller.role)) return res.status(403).json({ error: "This account is not allowed to delete users." });
    if (tooMany(caller.uid)) return res.status(429).json({ error: "Too many requests. Wait a minute and try again." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const uid = String(body.uid || "");
    const deleteData = body.deleteData === true;
    if (!UID_PATTERN.test(uid)) return res.status(400).json({ error: "Invalid user ID." });
    if (uid === caller.uid) return res.status(400).json({ error: "You cannot delete your own account." });

    const auth = getAuth();
    const db = getFirestore();

    // Never delete another administrator from this endpoint.
    let target = null;
    try { target = await auth.getUser(uid); }
    catch (e) { if (e.code !== "auth/user-not-found") throw e; }
    if (target && ADMIN_ROLES.includes((target.customClaims || {}).role)) {
      return res.status(403).json({ error: "Administrator accounts cannot be deleted here." });
    }
    if (!target && !deleteData) return res.status(404).json({ error: "That user no longer exists." });

    const result = { authDeleted: false, dataDeleted: false };

    // 1. Remove the login first, so the user cannot sign in again while data is being cleaned up.
    if (target) { await auth.deleteUser(uid); result.authDeleted = true; }

    // 2. Optionally remove the profile and everything under it (Designs, Feedback).
    if (deleteData) {
      try { await db.recursiveDelete(db.doc(`Users/${uid}`)); result.dataDeleted = true; }
      catch (e) { console.error("data cleanup failed:", e); }
    }

    // 3. Audit record (written by the server, so it cannot be edited from the browser).
    await db.collection("AdminActivity").add({
      Type: "deleteUser", AdminUid: caller.uid, AdminEmail: caller.email || "",
      TargetUid: uid, TargetEmail: target ? (target.email || "") : "",
      AuthDeleted: result.authDeleted, DataRequested: deleteData, DataDeleted: result.dataDeleted,
      At: FieldValue.serverTimestamp()
    }).catch((e) => console.error("audit write failed:", e));

    if (deleteData && !result.dataDeleted) {
      return res.status(500).json({ error: "The login was deleted, but cleaning up the user's data failed. Check Firestore.", ...result });
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("delete-user failed:", e);
    return res.status(500).json({ error: "Could not delete the user. Try again." });
  }
};