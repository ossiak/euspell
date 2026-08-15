// Generates libreoffice/tests/fixtures.tsv: <input>\t<expected> pairs produced
// by the REAL JS engine (walkTextNodes + convert over a <p>), so the Python port
// in libreoffice/euspell/engine.py can be checked against ground truth.
//
// Uses build/lib/dom-shim.js (no jsdom). The sentences deliberately avoid the
// ~70 semantic homographs and multi-word phrases, which the v1 Python port does
// not handle.
//
// Run: node build/gen-lo-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { installDomShim, el, tx } from './lib/dom-shim.js';

installDomShim();

const { walkTextNodes } = await import('../src/content/dom-walker.js');
const { convert } = await import('../src/content/converter.js');
const { SEMANTIC } = await import('../src/disambig/semantic/index.js');

// A sentence is in v1 scope only if it contains no semantic homograph (those are
// left to the user as choices, not auto-converted) — skip any that do.
const hasSemantic = (text) =>
  text.toLowerCase().match(/[a-z']+/g)?.some((w) => SEMANTIC.has(w)) ?? false;

function jsConvert(text) {
  const p = el('p', tx(text));
  walkTextNodes(p, convert);
  return p.childNodes.map((c) => c.nodeValue).join('');
}

// Ground-truth sentences: unchanged words, single-spelling reforms, NN2|VVZ
// diatones (noun & verb), 702 French plurals, 102 heteronyms, contractions,
// genitive 's, the pronoun I, capitalization, multi-sentence context.
const SENTENCES = [
  'The cat sat on the mat.',
  'They aahed at the view.',
  'Two records exist in the archive.',
  'She records the song every week.',
  'The anchors of ships are heavy.',
  'He anchors the boat each night.',
  'First aids were given.',
  'She aids him daily.',
  'The new machine records the data.',
  'John records his notes.',
  'Learning tools are useful.',
  'They handed over all domestic call records between those dates.',
  'The phone calls stopped at midnight.',
  'The chassis is broken.',
  'Two chassis were delivered.',
  'They separate the papers.',
  'The separate rooms were cold.',
  'I will separate them now.',
  'We use the tools.',
  'The use of force was wrong.',
  'I think it is fine.',
  'I am here.',
  'She is above the law.',
  'The above text is wrong.',
  'It could have been worse.',
  "The cat's tail is long.",
  "He's gone already.",
  'Above all, they thought it through.',
  'The rough night was long.',
  'People thought they could read it.',
  'The device which records sound is new.',
  'The committee debates the issue today.',
  'He debates whether to go.',
  'The permits expired last year.',
  'The city permits new building.',
  'Eight ounces of flour is enough.',
  'The night was rough and cold.',
  'Through the door they walked.',
  'Enough is enough, she thought.',
  'The daughter caught the ball.',
  // The Roman numeral one vs the pronoun: a capitalized label noun with no
  // article marks the numeral, which must survive; everything else stays the
  // pronoun. Pinned across engines because all three carry the rule.
  'Section I applies to every employer.',
  'He signed the section I finished.',
  // An "I" bound to what follows is the letter, not the pronoun.
  'Contact your local I&A Unit for help.',
  'The I-beam was steel.',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'libreoffice', 'tests');
mkdirSync(outDir, { recursive: true });
const kept = SENTENCES.filter((s) => !hasSemantic(s));
const skipped = SENTENCES.length - kept.length;
const rows = kept.map((s) => `${s}\t${jsConvert(s)}`);
writeFileSync(join(outDir, 'fixtures.tsv'), `${rows.join('\n')}\n`, 'utf8');
console.log(`[gen-lo-fixtures] wrote ${rows.length} fixtures (skipped ${skipped} with semantic words)`);
for (const r of rows) console.log(`  ${r.replace('\t', '  =>  ')}`);
