(function () {
  'use strict';

  // Light / dark theme. Follows the device until the visitor picks one with the button.
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeBtn');
  var dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function currentTheme() {
    var t = root.dataset.theme;
    if (t === 'dark' || t === 'light') return t;
    return dark && dark.matches ? 'dark' : 'light';
  }
  function paintTheme() {
    if (!themeBtn) return;
    var t = currentTheme();
    themeBtn.dataset.mode = t;
    themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('acim-theme', next); } catch (e) {}
      paintTheme();
    });
    if (dark && dark.addEventListener) dark.addEventListener('change', paintTheme);
    paintTheme();
  }

  // Floor plan in the hero: switch carpet, arch and flowers on and off
  document.querySelectorAll('.tool').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      var group = document.getElementById(btn.dataset.target);
      if (group) group.classList.toggle('off', !on);
    });
  });

  // Footer link that reopens the cookie notice
  document.querySelectorAll('[data-cookie-settings]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.openCookieSettings) window.openCookieSettings();
    });
  });

  // Mobile menu
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('navMenu');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // Gallery filter
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('#galleryGrid .g');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.filter;
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      cards.forEach(function (card) {
        card.hidden = !(f === 'all' || card.dataset.cat === f);
      });
    });
  });

  // Sticky mobile download button: shown after the hero, hidden over the download section
  var sticky = document.getElementById('stickyDl');
  var hero = document.getElementById('home');
  var dl = document.getElementById('download');
  var heroGone = false, dlVisible = false;
  function updateSticky() { sticky.hidden = !heroGone || dlVisible; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { heroGone = !en[0].isIntersecting; updateSticky(); }).observe(hero);
    new IntersectionObserver(function (en) { dlVisible = en[0].isIntersecting; updateSticky(); }, { threshold: 0.2 }).observe(dl);
  }

  // APK button: confirm the file exists before starting the download
  var apkBtn = document.getElementById('apkBtn');
  var status = document.getElementById('apkStatus');
  apkBtn.addEventListener('click', function (e) {
    if (location.protocol === 'file:') return; // local preview: let the browser handle it
    e.preventDefault();
    status.textContent = 'Checking the download...';
    fetch(apkBtn.getAttribute('href'), { method: 'HEAD' }).then(function (res) {
      if (!res.ok) throw new Error('missing');
      status.textContent = 'Starting download.';
      window.location.href = apkBtn.getAttribute('href');
    }).catch(function () {
      status.textContent = 'The APK is not available yet. Please check back soon or contact Z&L Event Organizing Services.';
    });
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();