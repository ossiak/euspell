# Keeping a page in traditional spelling

Some documents must not be reformed. Anything that writes *about* the reform is
the clear case: the euspell white paper sets `through` against `thruh` in the
same table, so converting it would rewrite the traditional column too and destroy
the comparison. Conversion is also not idempotent for every word, so a pass over
text that is already euspell over-transforms it.

There are two opt-outs, one per surface. Both are read by the extension; neither
needs any change on the reader's side.

## HTML — `data-euspell="off"`

Put the attribute on any element. Its whole subtree, however deep, stays in
traditional spelling:

```html
<article data-euspell="off">
  <p>Traditional spelling: <em>through</em> — euspell: <em>thruh</em>.</p>
</article>
```

The value is matched case-insensitively, and only `off` opts out — any other
value (or no attribute) converts normally. The check climbs the full ancestor
chain, so it survives the extension re-walking a subtree after the page mutates.

Implemented in [`src/content/dom-walker.js`](../src/content/dom-walker.js),
alongside the existing tag skips (`SCRIPT`, `STYLE`, `NOSCRIPT`, `TEXTAREA`,
`INPUT`, `CODE`, `PRE`) and the `contenteditable` rule.

## PDF — `?euspell=off`

A PDF has no markup to hang an attribute on, and the extension decides whether to
redirect a `.pdf` navigation into its own viewer *before* any response exists — so
the URL is the only signal available in time. Link the file with `euspell=off` in
the query string and the redirect is skipped, leaving the browser's own viewer to
render it unconverted:

```html
<a href="/paper.pdf?euspell=off">Read the white paper (PDF)</a>
```

This covers both detection paths — the `.pdf` suffix path and the
header-sniffing path that catches extensionless PDFs — and it suppresses the
sniff request too, so an opted-out URL is never fetched by the extension.

Implemented in
[`src/background/service-worker.js`](../src/background/service-worker.js).

## Limits worth knowing

- **The PDF opt-out travels with the link, not the file.** A reader who types the
  bare `/paper.pdf` URL, or opens it from history or a search result, gets the
  converted view. If that matters, serve the paper as HTML with
  `data-euspell="off"`, which has no such hole.
- **Neither opt-out is a security boundary.** They are a publisher's request,
  honoured by the extension; a reader can still convert the page manually.
- **Word-processor add-ins ignore both.** Those are one-pass converters driven by
  an explicit command, so the user has already asked for the conversion.

Covered by `tests/dom-walker.test.js` and `tests/service-worker.test.js`.

The white paper is published with both markers in place; how that publish works,
and what re-exporting the ODT would otherwise silently drop, is in
[paper-publishing.md](paper-publishing.md).
