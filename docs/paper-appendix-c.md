# Appendix C. Installing word processor add-ins

*Draft for the white paper (*Spelling Reform: An Engineering Approach*), where
Appendix C is currently a TODO. Condensed from
[installing-addins.md](installing-addins.md), which stays the maintained version —
update that first, then re-condense here.*

---

Euspell converts documents in four word processors: **Microsoft Word**,
**LibreOffice Writer**, **Google Docs**, and **Apple Pages**. All four are driven
by the same engine used by the browser extension, so a sentence reforms
identically wherever it is converted.

Two things distinguish these from the browser extension (Appendix A) and Eupub
(Appendix B), both of which install from a store or a released binary:

- **They are installed from source, not a store.** There is no marketplace
  listing for any of the four. Three need a one-time build on your own machine
  with Node 24 or newer; Word alone can also be loaded from a hosted copy with
  nothing built locally (C.2).
- **They are one-pass converters, not live spell-checkers.** You invoke a
  command and the document is rewritten, the way "translate this document" works.
  Nothing is underlined as you type. Neither Word nor LibreOffice will host a
  live third-party checker of this kind: LibreOffice crashes its Writing Aids
  dialog when a Python linguistic component is registered, and Google Docs and
  Pages expose no live hook at all.

Everything runs locally. The lexicon is bundled into each add-in, and no text is
uploaded.

<!-- markdownlint-disable-next-line MD036 -->
**Table C1. Word processor add-in capabilities**

| Word processor | Platforms | Whole document | Selection | Revert to traditional |
| --- | --- | --- | --- | --- |
| Microsoft Word | Windows, macOS, web | yes | yes | yes |
| LibreOffice Writer | Windows, Linux, macOS | yes | yes | yes |
| Google Docs | any browser | yes | yes | yes |
| Apple Pages | macOS only | yes | **no** | yes |

*Revert* is a lexicon-based reverse conversion, returning euspell text to
traditional (American) spelling. Apple Pages cannot act on a selection because it
exposes no scriptable text selection.

## C.1 Before you start

Clone the repository and install dependencies once:

```bash
npm install
```

Each add-in then has its own build command, given below. These regenerate a
roughly 5 MB dictionary payload from the lexicon, so they need re-running only
when the lexicon changes.

## C.2 Microsoft Word

An Office add-in is a small web application, so Word loads it over HTTPS from
somewhere. There are two routes, and the choice is whether you intend to change
the add-in.

**Using the hosted copy.** The add-in is published to GitHub Pages, so there is a
manifest to point Word at with nothing to build, no certificate, and no server:

```text
https://ossiak.github.io/euspell/manifest.xml
```

Sideload it as the platform requires: on the web, **Insert ▸ Add-ins ▸ Upload My
Add-in**; on Windows, save the file and add its folder under **File ▸ Options ▸
Trust Center ▸ Trust Center Settings ▸ Trusted Add-in Catalogs**, tick **Show in
Menu**, restart Word, then **Insert ▸ My Add-ins ▸ Shared Folder ▸ Euspell**; on
macOS, save it into `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`
and restart Word. This is the only route available to **Word on the web**, which
blocks a `localhost` task pane.

**Running it locally**, which is what you need to change it:

```powershell
npm run gen:word                     # engine, data, icons
npx office-addin-dev-certs install   # once — accept the prompt
npm run word:serve                   # leave running
```

Then, in a second terminal:

```powershell
npx office-addin-debugging start word-addin\manifest.xml
```

The committed `manifest.xml` points at `https://localhost:3000`, which is what
makes this work — and what the publishing workflow rewrites to produce the hosted
copy above. The server must stay running for as long as the add-in is in use.

Either way, on the **Home** ribbon tab click **Euspell** to open the task pane:
**Convert document** or **Convert selection**, and **Revert document / selection
to traditional** to go back.

**Stopping Word underlining euspell words.** Euspell words are not in Word's
dictionary, so the spell checker marks them. Either leave the task pane's
checkbox on, which marks converted text as "do not proof" (simple, but it also
stops Word catching genuine typos there), or install the euspell custom
dictionary, which preserves real typo checking: run `npm run gen:word-dict`, then
**File ▸ Options ▸ Proofing ▸ Custom Dictionaries ▸ Add…** and choose
`dict/euspell-word.dic`. If you install the dictionary, clear the task pane
checkbox.

## C.3 LibreOffice Writer

The install has two parts: the converter macro and engine are copied into your
LibreOffice user profile, and a small extension adds the top-level **Euspell**
menu. The menu invokes the copy in the profile, so **part one is a prerequisite
for part two**. Close LibreOffice before installing.

On **Linux**, one script does both and detects native versus Flatpak
installations automatically:

```bash
npm run gen:lo && npm run gen:lo:oxt
libreoffice/install-linux.sh
```

On **macOS**, likewise; the script locates `LibreOffice.app` in `/Applications`
or `~/Applications`:

```bash
npm run gen:lo && npm run gen:lo:oxt
libreoffice/install-macos.sh
```

On **Windows**:

```powershell
npm run gen:lo && npm run gen:lo:oxt
$dst = "$env:APPDATA\LibreOffice\4\user\Scripts\python"
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item ".\libreoffice\Scripts\python\euspell_convert.py" $dst -Force
Copy-Item ".\libreoffice\euspell" $dst -Recurse -Force
unopkg add --force .\dict\euspell-libreoffice.oxt
```

Restart LibreOffice and use **Euspell ▸ Convert Document** or **Convert
Selection**, or **Revert Document / Selection to Traditional**.

The extension itself is platform-neutral — it contains only configuration, no
compiled code — so the same `.oxt` installs everywhere. Only the profile location
differs, as shown in Table C2.

<!-- markdownlint-disable-next-line MD036 -->
**Table C2. LibreOffice user profile locations**

| Platform | Profile |
| --- | --- |
| Windows | `%APPDATA%\LibreOffice\4\user` |
| Linux (native) | `~/.config/libreoffice/4/user` |
| Linux (Flatpak) | `~/.var/app/org.libreoffice.LibreOffice/config/libreoffice/4/user` |
| macOS | `~/Library/Application Support/LibreOffice/4/user` |

On macOS, `unopkg` and `soffice` live inside the application bundle at
`Contents/MacOS` rather than on the path, which the installer handles.

**Only native Linux builds need the Python script provider** — the Flatpak and
the macOS application bundle both ship their own Python. If the Euspell menu does
not appear after restarting a native Linux install, add
`libreoffice-script-provider-python` on Debian and Ubuntu, or `libreoffice-pyuno`
on Fedora and openSUSE; Arch includes it.

## C.4 Google Docs

Google Docs renders document text to a `<canvas>` element, so a DOM-walking
browser extension never sees it. The add-on therefore goes through Google's
document API instead. Note that it binds to **a single document** — its menu
appears only in the document you install it into. Making it available across all
documents would mean publishing a Google editor add-on.

1. Open the target document, choose **Extensions ▸ Apps Script**, and copy the
   **Script ID** from **Project Settings**.
2. From the repository:

   ```bash
   npm install -g @google/clasp
   clasp login
   npm run gen:gas
   cd apps-script
   printf '{"scriptId":"YOUR_SCRIPT_ID","rootDir":"."}' > .clasp.json
   clasp push -f
   ```

3. Reload the document. An **Euspell** menu appears, offering **Convert
   Document** and **Convert Selection**. The first run asks for authorization;
   the scope is `documents.currentonly`, so the script can reach only that
   document.

The 5 MB data file is why this is pushed with `clasp` rather than pasted into the
script editor.

## C.5 Apple Pages

**macOS only.** Pages has no add-in model — no equivalent of Word's Office.js or
Google's Apps Script — so Euspell cannot run inside it. Instead a script drives
Pages from outside through macOS automation, reusing the Apps Script engine
unchanged.

```bash
npm run gen:pages
mkdir -p ~/Library/Scripts/Applications/Pages
cp pages/euspell-pages.js ~/Library/Scripts/Applications/Pages/Euspell.js
```

Enable the Script menu in **Script Editor ▸ Settings ▸ General ▸ Show Script menu
in menu bar**. Open a Pages document and choose **Euspell** from that menu; a
dialog offers **Convert to euspell** or **Revert to traditional**.

The first run asks permission to control Pages, granted in **System Settings ▸
Privacy & Security ▸ Automation**. Only the main body flow is reached: text in
text boxes, shapes, and table cells is left alone.

## C.6 Behaviour common to all four

- **Convert once.** A few reforms are not idempotent, so converting text that is
  already in euspell can over-transform those words. Revert first if in doubt.
- **Converted paragraphs lose inline formatting.** Each add-in replaces a
  paragraph's text as a whole, which resets bold and italic runs to the
  paragraph's default. The add-ins are best suited to plain-text documents. In
  Pages the entire body becomes a single formatting run.
- **Paragraphs containing images or other inline objects are skipped**, so that
  replacing text cannot delete the object.
- **Roughly 70 semantic homographs are left unchanged** — *read, bow, tear, are*
  and similar — because resolving them needs per-word rules that the ports do not
  carry. Context-decided cases such as *records* and *anchors* are converted, by
  the same SVM and part-of-speech rules the browser extension uses.
- **Multi-word phrases are not collapsed.**
- **The first conversion in a session takes a few seconds** while the dictionary
  loads; later conversions are quick.

## C.7 Troubleshooting

| Symptom | Try |
| --- | --- |
| **Word:** task pane blank, or "can't load add-in" | Running locally: the server is not running, or its certificate is untrusted — re-run `office-addin-dev-certs install` and `word:serve`, and confirm `https://localhost:3000/src/taskpane.html` loads without warning. Using the hosted copy: confirm the manifest URL itself resolves. |
| **Word:** no Euspell button on the Home tab | The manifest did not register. Use the shared-folder catalog method, and reopen Word. |
| **LibreOffice:** no Euspell menu | On native Linux, install the Python script provider. Otherwise the user-profile copy is missing — repeat part one with LibreOffice closed. |
| **Google Docs:** no Euspell menu | The add-on is bound to the document it was pushed to. Reload the page after `clasp push`. |
| **Pages:** "could not rewrite the document" | Grant automation permission in System Settings ▸ Privacy & Security. If it persists, the Pages version may name its text suite differently. |
| Words that should have changed did not | Most likely one of the 70 semantic homographs the add-ins leave unchanged deliberately. The browser extension does resolve these. |
| Text converted twice looks wrong | Revert, then convert once. |
