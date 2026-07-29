/**
 * Runtime shims for the JS methods PDF.js 6 relies on that older engines lack.
 * PDF.js 6.0.227 targets a very recent JS baseline; Android System WebView 128
 * (Chromium 128) — still shipping on current devices — provides none of the
 * methods below, so without the shims a PDF fails to open (the fingerprint
 * digest), fails to render (the page/font caches), or renders in substitute
 * system fonts instead of its embedded ones (glyph metrics). Each shim is a
 * standards-matching implementation, guarded by feature detection so it stays
 * inert on engines that already ship the method (the extension's desktop
 * Chrome, newer WebViews).
 *
 * This file is imported for its side effects by viewer.js (covering the page's
 * main thread) AND read verbatim by build/copy-pdfjs.js, which prepends it to
 * the copied worker (covering the worker's separate global scope — a page-level
 * shim can't reach it). Keep it dependency-free (no import/export) so it is
 * valid in both roles.
 *
 * Not shimmed: Float16Array. PDF.js feature-detects it (FeatureTest
 * .isFloat16ArraySupported) and falls back to Float32Array for glyph coords, so
 * its absence on WebView 128 is handled upstream with no visible effect.
 */

// Uint8Array.prototype.toHex — the ES2025 Uint8Array hex methods. PDF.js turns
// a document's MD5 digest into its fingerprint hex string with it, on open.
// Absent below Chromium 140.
if (typeof Uint8Array.prototype.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value() {
      let s = '';
      for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, '0');
      return s;
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

// Map/WeakMap.prototype.getOrInsert[Computed] — the TC39 "upsert" proposal.
// PDF.js leans on it across its page and font caches, so every page render
// touches it. Absent below Chromium 140.
for (const Ctor of [Map, WeakMap]) {
  if (typeof Ctor.prototype.getOrInsert !== 'function') {
    Object.defineProperty(Ctor.prototype, 'getOrInsert', {
      value(key, value) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (typeof Ctor.prototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(Ctor.prototype, 'getOrInsertComputed', {
      value(key, callbackFn) {
        if (this.has(key)) return this.get(key);
        const value = callbackFn(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
}

// Math.sumPrecise — the TC39 precise-summation method. PDF.js uses it while
// building glyph outlines and metrics (and in its text tools); when it is
// missing the embedded font fails to translate and the page silently falls
// back to substitute *system* fonts (e.g. "Cannot load system font: CMR12"),
// so the document renders in the wrong faces. Absent below Chromium 137. A
// Neumaier compensated sum is not the spec's correctly-rounded result, but is
// far more accurate than a naive sum and ample for these geometric uses.
if (typeof Math.sumPrecise !== 'function') {
  Object.defineProperty(Math, 'sumPrecise', {
    value(iterable) {
      let sum = 0;
      let compensation = 0;
      let count = 0;
      for (const value of iterable) {
        if (typeof value !== 'number') {
          throw new TypeError('Math.sumPrecise: all elements must be numbers');
        }
        count++;
        const t = sum + value;
        compensation += Math.abs(sum) >= Math.abs(value) ? sum - t + value : value - t + sum;
        sum = t;
      }
      return count === 0 ? -0 : sum + compensation;
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

// Promise.try — run a function and capture a synchronous throw or its return as
// a promise. Shipped in Chromium 128, so this matters only on older WebViews;
// kept for the same broad-compatibility reason as the rest.
if (typeof Promise.try !== 'function') {
  Object.defineProperty(Promise, 'try', {
    value(fn, ...args) {
      return new Promise((resolve) => resolve(fn(...args)));
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

// Uint8Array base64 (ES2025). PDF.js builds image data: URLs with toBase64()
// and reads signature bytes with fromBase64(). Absent below Chromium 140. Only
// the default (standard) alphabet is implemented — the sole form PDF.js uses.
if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    value() {
      let binary = '';
      for (let i = 0; i < this.length; i++) binary += String.fromCharCode(this[i]);
      return btoa(binary);
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
if (typeof Uint8Array.fromBase64 !== 'function') {
  Object.defineProperty(Uint8Array, 'fromBase64', {
    value(string) {
      const binary = atob(string);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
      return out;
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

// ReadableStream async iteration — `for await (const chunk of stream)` and
// stream.values(), the ES2024 async-iterator protocol on ReadableStream. PDF.js
// 6's page.getTextContent() async-iterates the text stream, and WebKit/Safari
// still ships ReadableStream WITHOUT Symbol.asyncIterator (a long-standing gap,
// absent through Safari 26 — https://bugs.webkit.org/show_bug.cgi?id=194379).
// Without it, text extraction throws "undefined is not a function" AFTER the
// page has rasterized, and the viewer's per-page catch then blanks every
// otherwise-rendered page. Standards-matching shim per the WHATWG spec, guarded
// so it stays inert where the engine already ships it (Chrome, newer WebViews).
if (
  typeof ReadableStream !== 'undefined' &&
  typeof ReadableStream.prototype[Symbol.asyncIterator] !== 'function'
) {
  const values = function ({ preventCancel = false } = {}) {
    const reader = this.getReader();
    return {
      async next() {
        try {
          const result = await reader.read();
          if (result.done) reader.releaseLock();
          return result;
        } catch (e) {
          reader.releaseLock();
          throw e;
        }
      },
      async return(value) {
        if (preventCancel) {
          reader.releaseLock();
        } else {
          const cancelPromise = reader.cancel(value);
          reader.releaseLock();
          await cancelPromise;
        }
        return { done: true, value };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
  const prop = { value: values, writable: true, configurable: true, enumerable: false };
  Object.defineProperty(ReadableStream.prototype, 'values', prop);
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, prop);
}
