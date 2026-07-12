// A small, unobtrusive status pill for dictation: shows listening state, the
// live interim transcript, and errors. Rendered in a shadow root so page CSS
// can't restyle it and its styles can't leak onto the page.

/**
 * Creates the overlay. Hidden until show() is called; created lazily by the
 * controller so a page that never dictates pays nothing.
 */
export function createOverlay() {
  const host = document.createElement('div');
  // all:initial first, so it can't reset the positioning declared after it.
  host.style.cssText =
    'all:initial;position:fixed;bottom:16px;right:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .pill {
        font: 13px/1.4 system-ui, sans-serif;
        color: #fff; background: #1a1a1a;
        border-radius: 18px; padding: 8px 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,.35);
        display: flex; align-items: center; gap: 8px;
        max-width: 320px;
      }
      .dot {
        width: 9px; height: 9px; border-radius: 50%;
        background: #e53935; flex: none;
        animation: pulse 1.2s ease-in-out infinite;
      }
      .pill.error .dot { background: #ffb300; animation: none; }
      .text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
    </style>
    <div class="pill"><span class="dot"></span><span class="text"></span></div>`;

  const pill = root.querySelector('.pill');
  const textEl = root.querySelector('.text');

  // SVG/XML documents have no <body>; fall back to the document element so
  // attaching the pill never throws (it may not render there, but dictation
  // into such a document is a dead end anyway).
  function attach() {
    if (!host.isConnected) (document.body ?? document.documentElement)?.appendChild(host);
  }

  return {
    /** @param {string} message */
    show(message) {
      pill.classList.remove('error');
      textEl.textContent = message;
      attach();
    },
    /** @param {string} message */
    error(message) {
      pill.classList.add('error');
      textEl.textContent = message;
      attach();
    },
    hide() {
      host.remove();
    },
  };
}
