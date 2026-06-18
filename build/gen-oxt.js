#!/usr/bin/env node
/**
 * Packages dict/euspell.aff + dict/euspell.dic into dict/euspell.oxt,
 * a LibreOffice extension that installs as a spell-checker dictionary.
 *
 * Run: node build/gen-oxt.js   (or: npm run gen:oxt)
 * Depends on dict/euspell.aff and dict/euspell.dic being current.
 * If they are stale, run npm run gen:wordlist first.
 *
 * Install in LibreOffice: Tools → Extension Manager → Add → select euspell.oxt
 *
 * Locale note: the dictionary registers under the private-use BCP47 tag
 * "en-x-euspell". In LibreOffice, set a paragraph or document language to
 * "English (Euspell)" to activate this dictionary exclusively. This avoids
 * contaminating the standard en-US/en-GB checker with euspell words.
 *
 * TODO: submit a proper locale registration to the Unicode CLDR / LibreOffice
 * to give "en-x-euspell" a friendly display name in the language picker.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const ROOT = new URL('..', import.meta.url);
const DICT = new URL('dict/', ROOT);

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', ROOT)), 'utf8'));
const { version } = pkg;

// ---------------------------------------------------------------------------
// XML file contents
// ---------------------------------------------------------------------------

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE manifest:manifest PUBLIC "-//OpenOffice.org//DTD Manifest 1.0//EN" "Manifest.dtd">
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry
    manifest:media-type="application/vnd.sun.star.configuration-data"
    manifest:full-path="dictionaries.xcu"/>
</manifest:manifest>
`;

const DESCRIPTION = `<?xml version="1.0" encoding="UTF-8"?>
<description
  xmlns="http://openoffice.org/extensions/description/2006"
  xmlns:d="http://openoffice.org/extensions/description/2006"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <identifier value="org.euspell.dictionary"/>
  <version value="${version}"/>
  <display-name>
    <name lang="en">Euspell Spelling Dictionary</name>
  </display-name>
  <publisher>
    <name lang="en" xlink:href="https://github.com/ossiak/euspell">Kamran Ossia</name>
  </publisher>
  <extension-description>
    <src lang="en" xlink:href="https://github.com/ossiak/euspell"/>
  </extension-description>
  <dependencies>
    <OpenOffice.org-minimal-version value="3.2" d:name="LibreOffice 3.2"/>
  </dependencies>
  <licenses>
    <license xlink:href="https://www.gnu.org/licenses/gpl-3.0.html"/>
  </licenses>
</description>
`;

// The Locales value uses the private-use BCP47 tag "en-x-euspell".
// LibreOffice 4.0+ accepts private-use subtags; the dictionary will only
// activate when the user explicitly selects this language variant.
const DICTIONARIES_XCU = `<?xml version="1.0" encoding="UTF-8"?>
<oor:component-data
  xmlns:oor="http://openoffice.org/2001/registry"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  oor:name="Linguistic"
  oor:package="org.openoffice.Office">
  <node oor:name="ServiceManager">
    <node oor:name="Dictionaries">
      <node oor:name="HunSpellDic_euspell" oor:op="replace">
        <prop oor:name="Locations" oor:type="oor:string-list">
          <value>%origin%/euspell.aff %origin%/euspell.dic</value>
        </prop>
        <prop oor:name="Format" oor:type="xs:string">
          <value>DICT_SPELL</value>
        </prop>
        <prop oor:name="Locales" oor:type="oor:string-list">
          <value>en-x-euspell</value>
        </prop>
      </node>
    </node>
  </node>
</oor:component-data>
`;

// ---------------------------------------------------------------------------
// Build the ZIP
// ---------------------------------------------------------------------------

const zip = new AdmZip();

zip.addFile('META-INF/manifest.xml', Buffer.from(MANIFEST, 'utf8'));
zip.addFile('description.xml',       Buffer.from(DESCRIPTION, 'utf8'));
zip.addFile('dictionaries.xcu',      Buffer.from(DICTIONARIES_XCU, 'utf8'));

zip.addLocalFile(fileURLToPath(new URL('euspell.aff', DICT)));
zip.addLocalFile(fileURLToPath(new URL('euspell.dic', DICT)));

const outPath = fileURLToPath(new URL('euspell.oxt', DICT));
zip.writeZip(outPath);

const sizeKb = (readFileSync(outPath).length / 1024).toFixed(0);
console.log(`[euspell-build] dict/euspell.oxt  — ${sizeKb} KB  (v${version})`);
console.log(`[euspell-build] Install: LibreOffice → Tools → Extension Manager → Add`);
