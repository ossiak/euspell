#!/usr/bin/env node
/**
 * Compiles the baked-in lexicon Map → an on-disk SQLite database, for hosts that
 * can't afford the full ~205k-entry table resident (a mobile reader keeps the
 * lexicon on disk and fetches only each chapter's vocabulary — see
 * src/content/lexicon-source.js). Ship dist/lexicon.db as an app asset; do NOT
 * build it on device.
 *
 * Run: node build/compile-lexicon-sqlite.mjs
 * Requires Node >= 22 (built-in node:sqlite).
 *
 * Schema: lex(k PRIMARY KEY, enc, pos, sp) WITHOUT ROWID
 *   k   lowercase surface word (the lookup key)
 *   enc integer encoding (converter reads enc % 10 = euspelling count)
 *   pos '|'-joined CLAWS7 tag set (tagger reads this; '' allowed)
 *   sp  '|'-joined euspellings ('' when the word never reforms)
 */
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { data as lexicon } from '../dist/lexicon.js';

// Output path: process.argv[2] (resolved against the caller's cwd) if given, so
// another project can emit the DB into its own dist; else euspell_ext/dist.
const OUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL('../dist/lexicon.db', import.meta.url));

try { fs.unlinkSync(OUT); } catch { /* first run */ }

const t0 = performance.now();
const db = new DatabaseSync(OUT);
db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
db.exec('CREATE TABLE lex(k TEXT PRIMARY KEY, enc INTEGER, pos TEXT, sp TEXT) WITHOUT ROWID;');

const ins = db.prepare('INSERT INTO lex(k, enc, pos, sp) VALUES(?, ?, ?, ?)');
db.exec('BEGIN');
let n = 0;
for (const [key, entry] of lexicon) {
  ins.run(key, entry.encoding, entry.pos.join('|'), entry.spellings.join('|'));
  n++;
}
db.exec('COMMIT');
// Compact and let SQLite build its primary-key B-tree tightly.
db.exec('VACUUM;');
db.close();

const size = fs.statSync(OUT).size;
console.log(
  `Wrote ${OUT}\n  ${n.toLocaleString()} entries, ${(size / 1048576).toFixed(1)} MB, ${(performance.now() - t0).toFixed(0)} ms`
);
