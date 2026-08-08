// ESLint flat config, replacing the legacy .eslintrc.json.
//
// The old file was never actually enforced: eslint was not a declared dependency
// (it happened to be present under web-ext), there was no `lint` script, and CI
// never ran it — so its rules drifted out of agreement with the code they were
// meant to govern. `npm run lint` and the CI step now hold it honest.
//
// eslintrc format is deprecated in ESLint 9 (it warns on every run) and dropped
// in v10, hence the move to flat config.
import globals from 'globals';

// Generated or vendored output. Everything here is regenerable or not ours, and
// linting it produced the great majority of the old config's reported problems —
// dist/ and build/firefox/ alone accounted for well over a hundred.
const ignores = [
  'dist/',
  'build/firefox/',
  'web-ext-artifacts/',
  '.next/',
  // Trained model weights and a derived word list, written by `npm run gen:svm`
  // and `npm run gen:vv0-prior`. Committed, but machine-authored.
  'src/disambig/vvz-svm.js',
  'src/disambig/vv0-prior.js',
  // Engine + lexicon copies stamped out for each host by the gen: scripts.
  'word-addin/src/euspell-engine.js',
  'word-addin/src/euspell-data.js',
  'pages/euspell-pages.js',
  // Apple's Safari app-extension template, vendored as Xcode generated it.
  'safari/',
];

// One rule set for the whole project; only the globals differ by environment.
const rules = {
  'no-var': 'error',
  'prefer-const': 'error',
  'no-eval': 'error',
  // Paired with no-eval, and expected by the code already: tests/ui.test.js
  // carries an eslint-disable for it over its deliberate `new Function` page
  // harness, a directive the old config left inert because it never enabled the
  // rule. Flat config reports unused directives, which is how that surfaced.
  'no-new-func': 'error',
  // `x == null` is the deliberate "null or undefined" test and is used as such
  // throughout (`tab?.id == null`, `c.goto != null`). The old config's bare
  // 'always' flagged all eight of those and none of them were bugs, which is a
  // fair share of why the config stopped being run. Everything else stays strict.
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': 'off',
  'prefer-template': 'error',
  'object-shorthand': 'error',
  'prefer-destructuring': ['warn', { array: false, object: true }],
};

export default [
  { ignores },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules,
  },
  // Extension surfaces: content scripts, the popup/options/onboarding pages, the
  // PDF viewer, and the Word task pane (which declares Office/Word/Euspell itself).
  {
    files: ['src/**/*.js', 'word-addin/src/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  // Node: the build pipeline, the test suite, the add-in dev server, rollup config.
  {
    files: ['build/**/*.{js,mjs}', 'tests/**/*.js', 'word-addin/server.js', 'rollup*.config.js'],
    languageOptions: { globals: globals.node },
  },
  // JXA (JavaScript for Automation) glue for Apple Pages: a classic script run by
  // osascript, not a module, against the macOS automation globals.
  {
    files: ['pages/*.js'],
    languageOptions: { sourceType: 'script', globals: { Application: 'readonly', Euspell: 'readonly' } },
    // Written in `var` throughout for the automation host. Modernising it is a
    // one-way bet on JavaScriptCore's behaviour under osascript that cannot be
    // checked from this repo — there is no macOS in CI and no test covers this
    // file — so the declarations stay as written rather than be changed blind
    // for a style rule.
    rules: { 'no-var': 'off' },
  },
];
