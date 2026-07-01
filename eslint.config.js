import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'src/routeTree.gen.ts']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // React Hooks + React Compiler rules (rules-of-hooks, exhaustive-deps,
  // preserve-manual-memoization, immutability, purity, refs, …). Catches the
  // Rules-of-React violations that would silently disable the compiler.
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  }
)
