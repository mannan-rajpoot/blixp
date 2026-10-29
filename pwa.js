/* Blixp app mode. Include in <head> of BOTH index.html and the editor page:
   <script src="/pwa.js"></script>
   Everything visual here only applies when the site is launched from the
   installed app icon. In a normal browser tab nothing changes. */
(function () {
  var d = document, root = d.documentElement;

  var isApp =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
    window.navigator.standalone === true;

  if (isApp) {
    root.classList.add('is-app');
    var st = d.createElement('style');
    st.textContent =
      /* no pull-to-refresh, no rubber-band bounce */
      'html.is-app,html.is-app body{overscroll-behavior:none;}' +
      /* no grey tap flash, no long-press callout, no double-tap zoom delay */
      'html.is-app{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;touch-action:manipulation;}' +
      /* native feel: UI is not selectable, inputs still are */
      'html.is-app body{-webkit-user-select:none;user-select:none;}' +
      'html.is-app input,html.is-app textarea,html.is-app [contenteditable],html.is-app [contenteditable] *{-webkit-user-select:text;user-select:text;}' +
      'html.is-app img,html.is-app a{-webkit-user-drag:none;}' +
      /* keep content clear of notch / home bar */
      'html.is-app body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);}';
    (d.head || root).appendChild(st);
  }

  /* make sure the install tags exist (harmless if already in the HTML) */
  function ensure(sel, make) {
    if (!d.head.querySelector(sel)) d.head.appendChild(make());
  }
  function meta(n, c) { var m = d.createElement('meta'); m.name = n; m.content = c; return m; }
  ensure('link[rel="manifest"]', function () {
    var l = d.createElement('link'); l.rel = 'manifest'; l.href = '/manifest.webmanifest'; return l;
  });
  ensure('meta[name="mobile-web-app-capable"]', function () { return meta('mobile-web-app-capable', 'yes'); });
  ensure('meta[name="apple-mobile-web-app-capable"]', function () { return meta('apple-mobile-web-app-capable', 'yes'); });
  ensure('meta[name="apple-mobile-web-app-title"]', function () { return meta('apple-mobile-web-app-title', 'Blixp'); });
  ensure('meta[name="apple-mobile-web-app-status-bar-style"]', function () { return meta('apple-mobile-web-app-status-bar-style', 'default'); });

  /* iPad / iPhone block pinch-zoom gestures inside the installed app only */
  if (isApp) {
    ['gesturestart', 'gesturechange'].forEach(function (t) {
      d.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
    });
  }

  /* service worker */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        reg.update();
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            /* new version activated: it applies on the next open, no forced reload */
          });
        });
      }).catch(function () {});
    });
  }
})();
