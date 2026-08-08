# Installing the Euspell Word add-in

An Office add-in is a small web app, so installing it means pointing Word at a
manifest that says where to load it from. Where it loads from gives two routes:

- **[Use the hosted copy](#use-the-hosted-copy)** — nothing to build, nothing to
  keep running. The one to pick if you only want to *use* the add-in.
- **Run it locally** — the numbered steps from
  [Prerequisites](#0-prerequisites) on, for *changing* it. Written for Word on
  Windows desktop, with notes for the web and Mac at the end.

Nothing is installed system-wide either way; removing the manifest removes the
add-in.

## Use the hosted copy

The add-in is published to GitHub Pages by
[pages.yml](../.github/workflows/pages.yml), so there is a manifest you can point
Word at as it stands:

```text
https://ossiak.github.io/euspell/manifest.xml
```

No build, no certificate, no server. Sideload it:

- **Word on the web** — **Insert ▸ Add-ins ▸ Upload My Add-in** and give it that
  URL. This is the *only* route the web version accepts: it blocks a `localhost`
  taskpane, so the local route below cannot serve it.
- **Windows** — save the file somewhere, then follow **Method B** in step 4
  below, pointing the catalog at the folder you saved it in.
- **Mac** — save it into
  `~/Library/Containers/com.microsoft.Word/Data/Documents/wef` and restart Word.

What you get is whatever was last deployed. To run your own changes, use the
steps below instead.

## 0. Prerequisites

- **Node.js** (already used to build this repo).
- **Microsoft Word** desktop (Microsoft 365 / 2016+).
- A terminal open in the repo root: `e:\Projects\Euspell\euspell_ext`.

## 1. Build the add-in files

```powershell
npm run gen:word
```

This generates the engine, the ~5 MB dictionary data, and the icons into
`word-addin\`. Re-run it only if the lexicon changes.

## 2. Trust the local HTTPS certificate (one time)

Office requires the add-in to be served over HTTPS. Create and trust a localhost
dev certificate:

```powershell
npx office-addin-dev-certs install
```

Accept the Windows prompt to install the certificate. You only do this once.

## 3. Start the local server

```powershell
npm run word:serve
```

You should see `Euspell add-in dev server: https://localhost:3000/`. **Leave this
window running** while you use the add-in. (Sanity check: open
`https://localhost:3000/src/taskpane.html` in a browser — it should load without
a certificate warning.)

## 4. Load the add-in into Word

Pick one method. **Method A is easiest.**

### Method A — automated (recommended)

In a **second** terminal (leave the server from step 3 running):

```powershell
npx office-addin-debugging start word-addin\manifest.xml
```

This registers the manifest and opens Word with the add-in loaded. The first time,
it may ask to install debugging components — accept.

### Method B — manual (shared-folder catalog)

Use this if Method A fails.

1. Create a folder, e.g. `C:\EuspellAddin`, and copy `word-addin\manifest.xml`
   into it.
2. Share the folder: right-click it ▸ **Properties ▸ Sharing ▸ Share…**, add your
   own Windows user, click **Share**. Note the network path shown, e.g.
   `\\YOUR-PC\EuspellAddin`.
3. In Word: **File ▸ Options ▸ Trust Center ▸ Trust Center Settings… ▸ Trusted
   Add-in Catalogs**.
4. Paste the `\\YOUR-PC\EuspellAddin` path into **Catalog Url**, click **Add
   catalog**, tick **Show in Menu**, then **OK** twice.
5. **Close and reopen Word.**
6. **Insert ▸ My Add-ins ▸** open the **Shared Folder** tab ▸ select **Euspell**
   ▸ **Add**.

## 5. Use it

- On the **Home** ribbon tab, click the **Euspell** button — the taskpane opens.
- Click **Convert document** or **Convert selection**.
- To go back, use **Revert document / selection to traditional** (a lexicon-based
  reverse conversion; it also turns Word's proofing back on).
- The first conversion takes a few seconds (it loads the dictionary); after that
  it's quick. Status shows how many paragraphs changed.

> **Convert once.** A few reforms aren't idempotent, so don't run it twice on the
> same text. Conversion replaces each paragraph's text, which resets inline
> formatting (bold/italic) in changed paragraphs and is best on plain-text
> documents (a paragraph holding an image is left alone).

## 6. Stop / uninstall

- **Stop using it:** close Word, and stop the dev server (Ctrl+C in its terminal).
- **Remove it (Method A):** `npx office-addin-debugging stop word-addin\manifest.xml`.
- **Remove it (Method B):** Trust Center ▸ Trusted Add-in Catalogs ▸ remove the
  catalog URL; and/or **Insert ▸ My Add-ins ▸** right-click Euspell ▸ Remove.

## Troubleshooting

- **Taskpane is blank / "can't load add-in":** running locally, the dev server
  (step 3) isn't running or the certificate isn't trusted — redo steps 2–3 and
  confirm `https://localhost:3000/src/taskpane.html` loads cleanly in a browser.
  On the hosted copy, confirm the manifest URL itself resolves in a browser.
- **No Euspell button on the Home tab:** the manifest didn't register — try the
  other method in step 4, and make sure you reopened Word.
- **Nothing converts:** check the taskpane status line for an error; ensure the
  document has English text and (for Convert selection) that text is selected.

## Word on the web / Mac

Both are covered by [the hosted copy](#use-the-hosted-copy), which is the simpler
answer for each and the only one the web version has.

If you are running locally and want these to load your own build:

- **Web:** not possible. Word on the web blocks a `localhost` taskpane, so a
  local server cannot serve it however the manifest is sideloaded. Deploy your
  changes and use the hosted copy.
- **Mac:** copy the repo's `manifest.xml` — the one pointing at `localhost:3000`
  — into `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`, restart
  Word, and use **Insert ▸ My Add-ins**, with the dev server running.
