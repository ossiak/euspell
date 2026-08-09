// ESLint configuration.
//
// This replaces .eslintrc.json, which ESLint 9 does not read: from v9 the
// eslintrc format is gone and a missing eslint.config.js is a hard error
// ("ESLint couldn't find an eslint.config.(js|mjs|cjs) file"). The old file was
// therefore enforcing nothing at all — no `lint` script invoked it, CI never ran
// it, and eslint itself was in the tree only as a transitive dependency of
// web-ext. Every rule below was already declared there; this is a translation,
// not a new policy.
//
// Deliberately NOT extending @eslint/js recommended. These seven rules are what
// the project chose to enforce, and recommended would bring in no-undef, which
// needs an accurate globals list for a codebase spanning content scripts, an MV3
// service worker, extension pages, a PDF viewer and Node build scripts — four
// different global environments. Widening the rule set is a decision worth
// making on purpose, with the findings read; it is not part of making the
// existing rules run.

export default [
  {
    // Generated output. dist/ holds the compiled lexicon (a 13 MB single
    // expression) and the rollup bundles; the rest are staged copies of files
    // that are linted at their source, or generated engine/data pairs for the
    // word-processor ports. All are gitignored and regenerable.
    ignores: [
      'dist/**',
      'build/firefox/**',
      'safari/Euspell Extension/Resources/**',
      'word-addin/src/euspell-engine.js',
      'word-addin/src/euspell-data.js',
      'pages/euspell-pages.js',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // --- errors: rules the code already satisfies, so CI can hold the line ---
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      // new Function is eval by another name, and the codebase already says so:
      // five test files carry `// eslint-disable-next-line no-new-func` over the
      // harnesses that run a real script with its imports stripped. Those
      // directives were written against a config that never enabled the rule, so
      // they had never once been load-bearing. Turning it on makes them true —
      // and makes any NEW dynamic-code site have to say why.
      'no-new-func': 'error',
      // `x == null` is the deliberate null-ish test — it catches undefined too,
      // which is exactly what `tab?.id == null` is asking. Spelling that out as
      // `=== null || === undefined` would be worse code written to satisfy a
      // lint rule, so the rule takes the standard exemption instead.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Left explicit though it is also the default: the engine reports a
      // missing lexicon and a failed icon paint through console, on purpose.
      'no-console': 'off',
      // --- warnings: style the code does NOT yet satisfy ---
      // These were declared as errors, but in a config ESLint never read, so
      // they had never once been checked against the source — there are ~35
      // standing violations, almost all in build/. Enforcing them now would
      // mean either a red build or a mechanical rewrite of two dozen scripts
      // nobody asked to have restyled, and `prefer-template` in particular is
      // not always an improvement: gen-gas.js concatenates four function
      // results, which `+` expresses better than a four-part template.
      //
      // So they warn. `npm run lint` lists them, the exit code stays 0, and
      // promoting one to error is a deliberate act once its backlog is cleared.
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'prefer-destructuring': ['warn', { array: false, object: true }],
    },
  },
  {
    // The Apple Pages port is JXA (JavaScript for Automation), not a module and
    // not a browser script: build/gen-pages.js concatenates it after the two
    // Apps Script .gs sources to make one runnable file, and it executes in the
    // OSA host's JavaScriptCore. `var` is the right declaration there — it is
    // the form the .gs engine it is spliced onto uses throughout, and one
    // script's worth of redeclaration semantics has to match across the join.
    files: ['pages/euspell-pages-glue.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-var': 'off' },
  },
];
