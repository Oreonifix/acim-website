(function () {
  var KEY = "acim-cookie-consent";

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function announce(v) {
    window.acimConsent = v;
    document.dispatchEvent(new CustomEvent("acim:consent", { detail: v }));
  }

  var saved = read();
  window.acimConsent = saved;

  var css = document.createElement("style");
  css.textContent =
    ".ck{position:fixed;left:16px;right:16px;bottom:16px;z-index:100;max-width:720px;margin:0 auto;" +
    "background:#17161a;color:#f3eee3;border:1px solid rgba(201,168,92,.55);border-radius:14px;" +
    "padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:400 .95rem/1.55 'Inter',system-ui,sans-serif}" +
    ".ck[hidden]{display:none}" +
    ".ck p{margin:0 0 14px;color:#e6dfd0}" +
    ".ck-row{display:flex;gap:10px;flex-wrap:wrap}" +
    ".ck button{flex:1 1 140px;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid #c9a85c;" +
    "font:600 .95rem inherit;font-family:inherit;cursor:pointer;transition:background .2s,color .2s}" +
    ".ck-yes{background:#c9a85c;color:#17161a}.ck-yes:hover{background:#a98a3f;color:#fff}" +
    ".ck-no{background:transparent;color:#f3eee3}.ck-no:hover{background:rgba(201,168,92,.18)}" +
    ".ck :focus-visible{outline:3px solid #c9a85c;outline-offset:3px}";
  document.head.appendChild(css);

  var box = document.createElement("div");
  box.className = "ck";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Cookie notice");
  box.innerHTML =
    "<p>This website uses cookies to keep it working and, if you allow, to understand how it is used. " +
    "You can accept or decline the optional ones.</p>" +
    '<div class="ck-row">' +
    '<button type="button" class="ck-yes">Allow cookies</button>' +
    '<button type="button" class="ck-no">Decline</button>' +
    "</div>";

  function choose(v) {
    write(v);
    box.hidden = true;
    announce(v);
  }
  box.querySelector(".ck-yes").addEventListener("click", function () { choose("accepted"); });
  box.querySelector(".ck-no").addEventListener("click", function () { choose("declined"); });

  function show() {
    box.hidden = false;
    box.querySelector(".ck-yes").focus();
  }
  window.openCookieSettings = show;

  function init() {
    document.body.appendChild(box);
    if (saved) announce(saved); else show();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();