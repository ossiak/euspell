// Packages the LibreOffice euspell extension into dict/euspell-libreoffice.oxt:
// a Tools-menu macro that converts a Writer document (or selection) into euspell
// reformed spelling, using the shared engine + data.
//
// This deliberately does NOT register linguistic spell/grammar services:
// passively-registered Python XSpellChecker/XProofreader components crash the
// Writing Aids dialog on LibreOffice 26.2 (see libreoffice/README.md). The
// components remain in libreoffice/euspell/ for reference but are not shipped.
//
// Run: npm run gen:lo:oxt   (depends on `npm run gen:lo` for the data files).
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import AdmZip from 'adm-zip';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LO = join(root, 'libreoffice');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const DATA_DIR = join(LO, 'euspell', 'data');
if (!existsSync(join(DATA_DIR, 'lexicon.csv')) || !existsSync(join(DATA_DIR, 'vvz_svm.tsv'))) {
  console.error('Missing libreoffice/euspell/data — run "npm run gen:lo" first.');
  process.exit(1);
}

const DESCRIPTION = `<?xml version="1.0" encoding="UTF-8"?>
<description
  xmlns="http://openoffice.org/extensions/description/2006"
  xmlns:d="http://openoffice.org/extensions/description/2006"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <identifier value="org.euspell.libreoffice"/>
  <version value="${version}"/>
  <display-name>
    <name lang="en">Euspell for LibreOffice</name>
  </display-name>
  <publisher>
    <name lang="en" xlink:href="https://github.com/ossiak/euspell">Kamran Ossia</name>
  </publisher>
  <extension-description>
    <src lang="en" xlink:href="https://github.com/ossiak/euspell"/>
  </extension-description>
  <dependencies>
    <OpenOffice.org-minimal-version value="4.1" d:name="LibreOffice 4.1"/>
  </dependencies>
  <licenses>
    <license xlink:href="https://www.gnu.org/licenses/gpl-3.0.html"/>
  </licenses>
</description>
`;

// Menu-only extension. It does NOT bundle the script/engine: invoking a script
// bundled inside an extension (location=user:uno_packages) fails in LO 26.2's
// script provider (mapPackageName2Path KeyError). Instead the menu calls the
// macro in the user profile (location=user), i.e. the copy installed under
// $(user)/Scripts/python — the same invocation the macro organizer uses and
// which works. So the user-profile install of euspell_convert.py + euspell/ is
// a prerequisite for the menu (see libreoffice/README.md).
const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE manifest:manifest PUBLIC "-//OpenOffice.org//DTD Manifest 1.0//EN" "Manifest.dtd">
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry
    manifest:media-type="application/vnd.sun.star.configuration-data"
    manifest:full-path="Addons.xcu"/>
</manifest:manifest>
`;

// Euspell ▸ Convert Document / Convert Selection. The URLs invoke the macro in
// the user profile's Scripts/python (location=user).
const SCRIPT = 'vnd.sun.star.script:euspell_convert.py$';
const LOC = '?language=Python&amp;location=user';
const ADDONS = `<?xml version="1.0" encoding="UTF-8"?>
<oor:component-data
    xmlns:oor="http://openoffice.org/2001/registry"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    oor:name="Addons" oor:package="org.openoffice.Office">
  <node oor:name="AddonUI">
    <node oor:name="OfficeMenuBar">
      <node oor:name="org.euspell.libreoffice.menu" oor:op="replace">
        <prop oor:name="Title" oor:type="xs:string"><value xml:lang="en-US">Euspell</value></prop>
        <prop oor:name="Target" oor:type="xs:string"><value>_self</value></prop>
        <prop oor:name="Context" oor:type="xs:string"><value>com.sun.star.text.TextDocument</value></prop>
        <node oor:name="Submenu">
          <node oor:name="m1" oor:op="replace">
            <prop oor:name="URL" oor:type="xs:string"><value>${SCRIPT}convert_document${LOC}</value></prop>
            <prop oor:name="Title" oor:type="xs:string"><value xml:lang="en-US">Convert Document to Euspell</value></prop>
            <prop oor:name="Context" oor:type="xs:string"><value>com.sun.star.text.TextDocument</value></prop>
          </node>
          <node oor:name="m2" oor:op="replace">
            <prop oor:name="URL" oor:type="xs:string"><value>${SCRIPT}convert_selection${LOC}</value></prop>
            <prop oor:name="Title" oor:type="xs:string"><value xml:lang="en-US">Convert Selection to Euspell</value></prop>
            <prop oor:name="Context" oor:type="xs:string"><value>com.sun.star.text.TextDocument</value></prop>
          </node>
          <node oor:name="m3" oor:op="replace">
            <prop oor:name="URL" oor:type="xs:string"><value>private:separator</value></prop>
          </node>
          <node oor:name="m4" oor:op="replace">
            <prop oor:name="URL" oor:type="xs:string"><value>${SCRIPT}revert_document${LOC}</value></prop>
            <prop oor:name="Title" oor:type="xs:string"><value xml:lang="en-US">Revert Document to Traditional</value></prop>
            <prop oor:name="Context" oor:type="xs:string"><value>com.sun.star.text.TextDocument</value></prop>
          </node>
          <node oor:name="m5" oor:op="replace">
            <prop oor:name="URL" oor:type="xs:string"><value>${SCRIPT}revert_selection${LOC}</value></prop>
            <prop oor:name="Title" oor:type="xs:string"><value xml:lang="en-US">Revert Selection to Traditional</value></prop>
            <prop oor:name="Context" oor:type="xs:string"><value>com.sun.star.text.TextDocument</value></prop>
          </node>
        </node>
      </node>
    </node>
  </node>
</oor:component-data>
`;

const zip = new AdmZip();
zip.addFile('description.xml', Buffer.from(DESCRIPTION, 'utf8'));
zip.addFile('META-INF/manifest.xml', Buffer.from(MANIFEST, 'utf8'));
zip.addFile('Addons.xcu', Buffer.from(ADDONS, 'utf8'));

const out = join(root, 'dict', 'euspell-libreoffice.oxt');
zip.writeZip(out);
console.log(`[gen-lo-oxt] wrote ${out} (v${version})`);
for (const e of zip.getEntries()) console.log('  ' + e.entryName);
