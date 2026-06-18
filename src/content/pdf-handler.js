/**
 * PDF.js integration: intercepts text layer rendering to apply euspell conversion.
 *
 * Chrome's built-in PDF viewer uses PDF.js. We hook into the eventBus after the
 * viewer application initialises. This script is imported by content.js only when
 * document.contentType === 'application/pdf'.
 *
 * Reference: https://mozilla.github.io/pdf.js/api/
 */

import { convert } from './converter.js';

export function initPdfHandler() {
  // PDF.js exposes PDFViewerApplication as a global on the page's window.
  // Because content scripts run in an isolated world we must inject a script
  // into the MAIN world to access it.
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/pdf-hook.js');
  (document.head ?? document.documentElement).appendChild(script);
  script.remove();
}

// TODO: implement pdf-hook.js (runs in MAIN world, hooks PDFViewerApplication.eventBus)
