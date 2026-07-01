/**
 * euspell conversion engine for Google Apps Script — a self-contained port of
 * the JS engine (src/content/converter.js, tagger.js, context.js + the POS
 * predicates in src/disambig/pos.js and the NN2|VVZ SVM). Pure logic + lazy data
 * parsing; no DOM, no ES modules, so it runs as a plain .gs file.
 *
 * The dictionary data is provided by euspell-data.gs as global strings
 * (EUSPELL_LEXICON_CSV, EUSPELL_ABBR_CSV, EUSPELL_CONTR_CSV, EUSPELL_SVM_TSV);
 * they are parsed on the first convertText() call and memoized for the run.
 *
 * Ported faithfully for everything except the ~70 per-word semantic rules and
 * multi-word phrases (same scope as the LibreOffice port): a word that needs a
 * semantic rule is left unchanged.
 */
var Euspell = (function () {
  'use strict';

  var LEXICON = null;   // key -> { pos:[], encoding:int, spellings:[] }
  var ABBR = null;
  var CONTR = null;     // apostrophe-normalized, lowercased key
  var SVM = null;       // feature -> weight
  var REVERSE = null;   // euspell reformed form -> traditional word (for revert)

  var KEEP_UNCHANGED = { bach: 1, chis: 1, ravined: 1 };

  // Surface words whose multi-spelling choice needs a semantic rule (not ported).
  var SEMANTIC_WORDS = {};
  ('barred bass beloved blessed bow bowed bowing bowman bowings bowmen bows ' +
   'chi cleanly close closer conch copyread does dogged dove foreread gets jagged ' +
   'lead leads learned longed looks makes means minute misread outread primate ' +
   'primates proofread ragged read reread row rowed rows rowing secreted secreting ' +
   'shower showers sightread slough sloughed sloughier sloughiest sloughiness ' +
   'sloughs sloughy sounds tear tearing tears thinks unbowed unbowing uncleanly ' +
   'wants wicked wind winding winds wound').split(' ').forEach(function (w) { SEMANTIC_WORDS[w] = 1; });

  function normApos(w) { return w.replace(/[’ʼ]/g, "'"); }

  function parseLexicon(text, target, keyTransform) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\r$/, '');
      if (!line) continue;
      var c = line.split(',');
      if (c.length < 4) continue;
      var enc = c[2];
      if (!/^[0-9]+$/.test(enc)) continue; // skip header / blanks
      var sp = c[3];
      var spellings = (sp === '' || sp === '[]') ? [] : sp.split('|');
      var key = keyTransform ? keyTransform(c[0]) : c[0];
      target[key] = { pos: c[1].split('|'), encoding: parseInt(enc, 10), spellings: spellings };
    }
  }

  function ensureLoaded() {
    if (LEXICON) return;
    LEXICON = {};
    ABBR = {};
    CONTR = {};
    SVM = {};
    parseLexicon(EUSPELL_LEXICON_CSV, LEXICON);
    parseLexicon(EUSPELL_ABBR_CSV, ABBR);
    parseLexicon(EUSPELL_CONTR_CSV, CONTR, function (k) { return normApos(k).toLowerCase(); });
    var sv = EUSPELL_SVM_TSV.split('\n');
    for (var i = 0; i < sv.length; i++) {
      var ln = sv[i].replace(/\r$/, '');
      if (!ln) continue;
      var t = ln.indexOf('\t');
      if (t < 0) continue;
      SVM[ln.slice(0, t)] = parseFloat(ln.slice(t + 1));
    }
    buildReverse();
  }

  // Reverse map for revert (euspell -> traditional). A reformed spelling maps
  // back to its headword; the first source wins for variant pairs. A phonetic
  // reform that happens to coincide with a real word (ruff, dorr, putz) is still
  // reverted, since in euspell text it is almost always the reform. The one
  // exclusion is a British->American normalization (encoding 601) whose target
  // is itself a standard word (abolitionize, acknowledgment): those are left as
  // the valid word rather than reverted to the British spelling. Contraction
  // clitics ('z -> 's) are included.
  // Reduce a British spelling to its American form across the common variant
  // classes. Only ever consulted between two sources of the same euspell form
  // (or a source and a standard headword), so it can't mis-fire on an unrelated
  // word even where a rule is broad (e.g. re$ -> er also rewrites "acre").
  function americanize(w) {
    return w
      .replace(/our(s?)$/, 'or$1')                                            // colour -> color
      .replace(/isation(s?)$/, 'ization$1')                                   // organisation -> organization
      .replace(/ise(s|d)?$/, function (m, s) { return 'ize' + (s || ''); })   // organise(s|d) -> organize
      .replace(/ising$/, 'izing')
      .replace(/yse(s|d)?$/, function (m, s) { return 'yze' + (s || ''); })   // analyse -> analyze
      .replace(/ysing$/, 'yzing')
      .replace(/ence(s?)$/, 'ense$1')                                         // defence -> defense
      .replace(/re$/, 'er')                                                   // centre -> center, metre -> meter
      .replace(/ogue(s?)$/, 'og$1')                                           // catalogue -> catalog
      .replace(/gramme(s?)$/, 'gram$1')                                       // programme -> program
      .replace(/dgement(s?)$/, 'dgment$1');                                   // judgement -> judgment
  }
  // Prefer the American spelling, matching the forward British->American
  // normalization: two sources of one euspell form that reduce to the same
  // American spelling -> keep whichever is already American. Non-variant pairs
  // (night/nite) reduce differently, so the first-seen source is kept.
  function moreAmerican(a, b) {
    if (a === b) return false;
    var amA = americanize(a), amB = americanize(b);
    return amA === amB && a === amA;
  }
  function buildReverse() {
    REVERSE = {};
    function addFrom(map) {
      for (var key in map) {
        var entry = map[key];
        var sp = entry.spellings;
        for (var i = 0; i < sp.length; i++) {
          var e = sp[i];
          if (e === key) continue;
          if (LEXICON[e]) {
            if (entry.encoding === 601) continue;                    // British -> American target
            if (LEXICON[e].spellings.indexOf(e) !== -1) continue;    // e maps to itself (colors): leave American
            if (americanize(key) === e) continue;                    // key is British-longer of e (judgement->judgment): keep American e
          }
          if (!(e in REVERSE) || moreAmerican(key, REVERSE[e])) REVERSE[e] = key;
        }
      }
    }
    addFrom(LEXICON);
    for (var ck in CONTR) {
      var csp = CONTR[ck].spellings;
      for (var j = 0; j < csp.length; j++) {
        var ce = csp[j];
        if (ce !== ck && !(ce in REVERSE)) REVERSE[ce] = ck;
      }
    }
  }

  function getContraction(word) { return CONTR[normApos(word).toLowerCase()]; }
  function isContraction(word) { return Object.prototype.hasOwnProperty.call(CONTR, normApos(word).toLowerCase()); }

  function contractionComponents(word) {
    var entry = getContraction(word);
    if (!entry) return [];
    var seqs = entry.pos.map(function (a) { return a.trim().split(/\s+/).filter(Boolean); });
    var width = 0;
    seqs.forEach(function (s) { if (s.length > width) width = s.length; });
    var positions = [];
    for (var i = 0; i < width; i++) positions.push([]);
    seqs.forEach(function (seq) {
      seq.forEach(function (tag, i) { if (positions[i].indexOf(tag) === -1) positions[i].push(tag); });
    });
    return positions.map(function (p) { return p.join('|'); });
  }

  // --- tagger ---------------------------------------------------------------
  function tagWord(word) {
    var key = word.toLowerCase();
    var entry = LEXICON[key] || ABBR[key] || getContraction(word);
    if (entry) return entry.pos.join('|');
    if (/^\d/.test(key)) return 'MC';
    return '';
  }

  // --- tokenizer ------------------------------------------------------------
  var RUN = /['’ʼ]?\w+(?:['’ʼ]\w+)*['’ʼ]?/g;
  var GENITIVE = /^(\w+)(['’ʼ]s)$/i;
  var SENTENCE_BREAK = /[.!?]/;

  function classifyRun(run, out) {
    if (isContraction(run)) { out.push({ kind: 'contraction', text: run }); return; }
    var gen = GENITIVE.exec(run);
    if (gen && isContraction("'s")) {
      out.push({ kind: 'word', text: gen[1] });
      out.push({ kind: 'contraction', text: gen[2] });
      return;
    }
    var lead = (run.match(/^['’ʼ]+/) || [''])[0];
    var rest = run.slice(lead.length);
    var trail = (rest.match(/['’ʼ]+$/) || [''])[0];
    var core = rest.slice(0, rest.length - trail.length);
    if (lead) out.push({ kind: 'sep', text: lead });
    if (core) out.push({ kind: 'word', text: core });
    if (trail) out.push({ kind: 'sep', text: trail });
  }

  function tokenize(text) {
    var segs = [];
    var last = 0;
    var m;
    RUN.lastIndex = 0;
    while ((m = RUN.exec(text))) {
      if (m.index > last) segs.push({ kind: 'sep', text: text.slice(last, m.index) });
      classifyRun(m[0], segs);
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ kind: 'sep', text: text.slice(last) });
    return segs;
  }

  // --- context window -------------------------------------------------------
  var BOUNDARY = { word: '', tag: 'ZB', breakAfter: true };

  function crossesSentenceBreak(tokens, from, to) {
    var lo = Math.min(from, to), hi = Math.max(from, to);
    for (var k = lo; k < hi; k++) if (tokens[k].breakAfter) return true;
    return false;
  }
  function contextWindow(tokens, idx) {
    function at(i) {
      if (i < 0 || i >= tokens.length || crossesSentenceBreak(tokens, idx, i)) return BOUNDARY;
      return tokens[i];
    }
    return [at(idx - 3), at(idx - 2), at(idx - 1), tokens[idx], at(idx + 1), at(idx + 2), at(idx + 3)];
  }
  function tagsOf(t) { return t.tag ? t.tag.split('|') : []; }
  function anyPrefix(token, prefixes) {
    return tagsOf(token).some(function (t) { return prefixes.some(function (p) { return t.indexOf(p) === 0; }); });
  }
  function anyExact(token, tags) {
    return tagsOf(token).some(function (t) { return tags.indexOf(t) !== -1; });
  }

  var DETERMINER = ['AT', 'AT1', 'DD', 'DD1', 'DD2', 'DA', 'DA1', 'DA2', 'DAR', 'DAT', 'DB', 'DB2'];
  var PREMODIFIER = ['APPGE', 'JJ', 'MC', 'MD', 'MF'];
  var PREPOSITION = ['II', 'IO', 'IF', 'IW'];
  var SUBJECT_3SG = ['PPHS1', 'PPH1'];
  var REL_SUBJECT = ['PNQS', 'DDQ', 'CST'];
  var VERB_ANY = ['VV', 'VB', 'VH', 'VD', 'VM'];
  var PLURAL_VERB = ['VV0', 'VBR', 'VBDR', 'VH0', 'VD0'];
  var OBJECT_PRONOUN = ['PPHO', 'PPIO', 'PPX', 'PPH1', 'PPY'];
  var SINGULAR_NOUN = ['NN1', 'NNU1', 'NNL1', 'NNT1', 'NNO1', 'NNB', 'NP1'];
  var ADVERB = ['RR', 'RG', 'RP', 'RL', 'RT', 'RA'];
  var SUBJECT_PRON = ['PPHS1', 'PPH1', 'PPHS2', 'PPIS1', 'PPIS2', 'PPY'];
  var VV0_SUBJECT_PRON = ['PPIS1', 'PPIS2', 'PPHS2', 'PPY'];
  var DEGREE_ADVERB = ['RG', 'RGR', 'RGT', 'RGQ'];
  var PLURAL_DET = ['DD2', 'DA2', 'DB2'];
  var CARDINAL = ['MC', 'MC2'];
  var SINGULAR_DET = ['AT1', 'DD1', 'MC1', 'DA1'];
  var PLURAL_AGREE = ['VBR', 'VBDR', 'VH0', 'VD0'];
  var SINGULAR_AGREE = ['VBZ', 'VBDZ', 'VHZ', 'VDZ', 'VVZ'];

  function isPureAdverb(token) {
    var tags = tagsOf(token);
    return tags.length > 0 && tags.every(function (t) {
      return ADVERB.some(function (p) { return t.indexOf(p) === 0; });
    });
  }

  // --- NN2|VVZ SVM ----------------------------------------------------------
  function svmFamily(tag) {
    if (tag.indexOf('NP') === 0) return 'NP';
    if (tag.indexOf('NN') === 0) return 'NN';
    if (tag === 'PPHS1' || tag === 'PPH1') return 'SUBJ3SG';
    if (tag.indexOf('PPHO') === 0 || tag.indexOf('PPIO') === 0 || tag.indexOf('PPX') === 0 || tag.indexOf('PPY') === 0) return 'OBJPRON';
    if (tag === 'AT' || tag === 'AT1' || tag.indexOf('DD') === 0 || tag.indexOf('DA') === 0 || tag.indexOf('DB') === 0) return 'DET';
    if (tag.indexOf('APPGE') === 0) return 'POSS';
    if (tag.indexOf('II') === 0 || tag.indexOf('IO') === 0 || tag.indexOf('IF') === 0 || tag.indexOf('IW') === 0) return 'PREP';
    if (tag.indexOf('JJ') === 0 || tag.indexOf('MC') === 0 || tag.indexOf('MD') === 0 || tag.indexOf('MF') === 0) return 'PREMOD';
    if (tag === 'VV0' || tag === 'VBR' || tag === 'VBDR' || tag === 'VH0' || tag === 'VD0') return 'PLVERB';
    if (tag.indexOf('VV') === 0 || tag.indexOf('VB') === 0 || tag.indexOf('VH') === 0 || tag.indexOf('VD') === 0 || tag.indexOf('VM') === 0) return 'VERB';
    if (tag.indexOf('RR') === 0 || tag.indexOf('RG') === 0 || tag.indexOf('RP') === 0 || tag.indexOf('RL') === 0 || tag.indexOf('RT') === 0 || tag.indexOf('RA') === 0) return 'ADV';
    if (tag === 'PNQS' || tag === 'DDQ' || tag === 'CST') return 'RELSUBJ';
    return tag.slice(0, 2);
  }
  var SVM_SLOTS = [[0, -3], [1, -2], [2, -1], [4, 1], [5, 2], [6, 3]];
  function svmFeatures(tokens, idx) {
    var win = contextWindow(tokens, idx);
    var word = tokens[idx] ? tokens[idx].word : '';
    var feats = ['bias', 'w=' + word.toLowerCase()];
    if (/^\p{Lu}/u.test(word)) feats.push('cap');
    for (var s = 0; s < SVM_SLOTS.length; s++) {
      var slot = SVM_SLOTS[s][0], off = SVM_SLOTS[s][1];
      var tok = win[slot];
      if (tok.tag === 'ZB') continue;
      if (tok.tag === '') { feats.push(off + '=UNK'); continue; }
      var fams = {};
      tok.tag.split('|').forEach(function (t) { fams[svmFamily(t)] = 1; });
      for (var f in fams) feats.push(off + '=' + f);
    }
    return feats;
  }
  function isVvzSvm(tokens, idx) {
    var feats = svmFeatures(tokens, idx);
    var score = 0;
    for (var i = 0; i < feats.length; i++) { var w = SVM[feats[i]]; if (w) score += w; }
    return score > 0;
  }

  // --- POS predicates -------------------------------------------------------
  function isVerbalS(tokens, idx) {
    var win = contextWindow(tokens, idx);
    var w1b = win[2], w1a = win[4], w2a = win[5];
    if (anyExact(w1b, SUBJECT_PRON)) return true;
    if (anyPrefix(w1a, ['VVN', 'VVG'])) return !anyPrefix(w2a, ['NN', 'NP']);
    return false;
  }
  function isVerbVv0(tokens, idx) {
    var win = contextWindow(tokens, idx);
    var w2b = win[1], w1b = win[2], w1a = win[4];
    var left = anyPrefix(w1b, ADVERB) ? w2b : w1b;
    var vote = 0;
    if (anyExact(left, ['TO'])) vote += 4;
    if (anyPrefix(left, ['VM'])) vote += 4;
    if (anyPrefix(left, ['VD'])) vote += 3;
    if (anyExact(left, VV0_SUBJECT_PRON)) vote += 3;
    if (anyPrefix(left, REL_SUBJECT)) vote += 2;
    if (anyExact(left, DETERMINER)) vote -= 4;
    if (anyPrefix(left, ['APPGE'])) vote -= 4;
    if (anyPrefix(left, ['VB'])) vote -= 3;
    if (anyPrefix(left, PREPOSITION)) vote -= 3;
    if (anyPrefix(left, ['MC', 'MD', 'MF'])) vote -= 2;
    if (anyExact(w1b, DEGREE_ADVERB)) vote -= 3;
    if (anyExact(w1a, DETERMINER) || anyPrefix(w1a, ['APPGE'])) vote += 2;
    if (anyPrefix(w1a, OBJECT_PRONOUN)) vote += 2;
    return vote > 0;
  }
  function isPluralNoun(tokens, idx) {
    var win = contextWindow(tokens, idx);
    var w2b = win[1], w1b = win[2], w1a = win[4];
    var vote = 0;
    if (anyExact(w1b, PLURAL_DET) || anyExact(w1b, CARDINAL)) vote += 3;
    if (anyExact(w1b, SINGULAR_DET)) vote -= 3;
    if (anyPrefix(w1b, ['JJ'])) {
      if (anyExact(w2b, PLURAL_DET) || anyExact(w2b, CARDINAL)) vote += 2;
      if (anyExact(w2b, SINGULAR_DET)) vote -= 2;
    }
    if (anyExact(w1a, PLURAL_AGREE)) vote += 3;
    if (anyExact(w1a, SINGULAR_AGREE)) vote -= 3;
    return vote > 0;
  }

  // --- conversion -----------------------------------------------------------
  function isSentenceStart(tokens, idx) {
    return idx === 0 || (idx > 0 && tokens[idx - 1].breakAfter);
  }
  function matchCase(original, replacement) {
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original.charAt(0) === original.charAt(0).toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }
  function route(key, entry, tokens, idx) {
    var pos = entry.pos, enc = entry.encoding;
    if ((enc === 12 || enc === 112) && pos.indexOf('VVZ') !== -1 && !SEMANTIC_WORDS[key]) {
      return isVvzSvm(tokens, idx) ? 1 : 0;
    }
    if (pos.indexOf('GE') !== -1) return isVerbalS(tokens, idx) ? 1 : 0;
    if (enc === 702 && pos.indexOf('NN2') !== -1) return isPluralNoun(tokens, idx) ? 1 : 0;
    if (enc === 102 && pos.indexOf('VV0') !== -1 && !SEMANTIC_WORDS[key]) {
      return isVerbVv0(tokens, idx) ? 1 : 0;
    }
    if (SEMANTIC_WORDS[key]) return null; // left unchanged
    return 0;
  }
  function convert(word, tokens, idx) {
    if (word === 'I') return isSentenceStart(tokens, idx) ? 'Ih' : 'ih';
    var key = word.toLowerCase();
    if (KEEP_UNCHANGED[key]) return word;
    var entry = LEXICON[key] || getContraction(word);
    if (!entry) return word;
    var variants = entry.encoding % 10;
    if (variants === 0) return word;
    var spellings = entry.spellings;
    if (variants === 1) return matchCase(word, spellings[0] != null ? spellings[0] : word);
    var spIdx = route(key, entry, tokens, idx);
    if (spIdx === null) return word;
    var repl = (spIdx >= 0 && spIdx < spellings.length) ? spellings[spIdx] : word;
    return matchCase(word, repl);
  }

  function buildTokens(text) {
    var pieces = [];
    var tokens = [];
    var segs = tokenize(text);
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg.kind === 'sep') {
        pieces.push({ text: seg.text, wordIdx: -1 });
        if (tokens.length && SENTENCE_BREAK.test(seg.text)) tokens[tokens.length - 1].breakAfter = true;
      } else if (seg.kind === 'contraction') {
        pieces.push({ text: seg.text, wordIdx: tokens.length });
        var comps = contractionComponents(seg.text);
        if (comps.length) {
          for (var j = 0; j < comps.length; j++) {
            tokens.push({ word: j === 0 ? seg.text : '', tag: comps[j], breakAfter: false });
          }
        } else {
          tokens.push({ word: seg.text, tag: tagWord(seg.text), breakAfter: false });
        }
      } else {
        pieces.push({ text: seg.text, wordIdx: tokens.length });
        tokens.push({ word: seg.text, tag: tagWord(seg.text), breakAfter: false });
      }
    }
    if (tokens.length) tokens[tokens.length - 1].breakAfter = true;
    return { pieces: pieces, tokens: tokens };
  }

  // --- public API -----------------------------------------------------------
  function convertText(text) {
    ensureLoaded();
    var bt = buildTokens(text);
    var out = '';
    for (var i = 0; i < bt.pieces.length; i++) {
      var p = bt.pieces[i];
      out += (p.wordIdx !== -1) ? convert(p.text, bt.tokens, p.wordIdx) : p.text;
    }
    return out;
  }

  // --- revert (euspell -> traditional) -------------------------------------
  var CLITIC = /^(.+)(['’ʼ][zs])$/;
  function revertWord(w) {
    if (w.toLowerCase() === 'ih') return 'I'; // pronoun: ih/Ih -> I
    var t = REVERSE[w.toLowerCase()];
    if (t) return matchCase(w, t);
    var m = CLITIC.exec(w); // "he'z" -> "he" + "'s"
    if (m) {
      var st = REVERSE[m[1].toLowerCase()];
      var stem = st ? matchCase(m[1], st) : m[1];
      var cl = REVERSE[normApos(m[2]).toLowerCase()];
      return stem + (cl != null ? cl : m[2]);
    }
    return w;
  }

  function revertText(text) {
    ensureLoaded();
    var segs = tokenize(text);
    var out = '';
    for (var i = 0; i < segs.length; i++) {
      out += (segs[i].kind === 'sep') ? segs[i].text : revertWord(segs[i].text);
    }
    return out;
  }

  function wordCandidates(word) {
    ensureLoaded();
    if (word === 'I') return ['ih'];
    var key = word.toLowerCase();
    if (KEEP_UNCHANGED[key]) return [];
    var entry = LEXICON[key] || getContraction(word);
    if (!entry || entry.encoding % 10 === 0) return [];
    var seen = [];
    entry.spellings.forEach(function (sp) {
      var cased = matchCase(word, sp);
      if (seen.indexOf(cased) === -1) seen.push(cased);
    });
    return seen;
  }

  return { convertText: convertText, revertText: revertText, wordCandidates: wordCandidates };
})();
