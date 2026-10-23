// Long text (.clamp) shows two lines with an ellipsis. Click it, or press Enter or Space, to read the whole text.
(function () {
  "use strict";
  var timer;

  function canToggle(el) { return el.classList.contains("more") || el.classList.contains("open"); }

  function mark() {
    document.querySelectorAll(".clamp").forEach(function (el) {
      if (el.classList.contains("open")) return;
      var long = el.scrollHeight > el.clientHeight + 1;
      el.classList.toggle("more", long);
      if (long) {
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-expanded", "false");
        el.title = "Show full text";
      } else {
        ["role", "tabindex", "aria-expanded", "title"].forEach(function (a) { el.removeAttribute(a); });
      }
    });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(mark, 30); }

  function toggle(el) {
    var open = el.classList.toggle("open");
    el.setAttribute("aria-expanded", String(open));
    el.title = open ? "Show less" : "Show full text";
    if (!open) schedule();
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest(".clamp");
    if (el && canToggle(el)) toggle(el);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var el = e.target;
    if (el && el.classList && el.classList.contains("clamp") && canToggle(el)) { e.preventDefault(); toggle(el); }
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();