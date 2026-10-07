import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Standalone rather than merged with vite.config.ts: the app config carries a
// dev-server proxy and the Tailwind plugin, neither of which a test run needs.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Explicit imports from 'vitest' instead of globals — the tsconfig has
    // verbatimModuleSyntax on and a `types` list that would otherwise need to
    // grow, and an imported `expect` is easier to trace than an ambient one.
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The UI shell and route wiring are not covered by these tests; the
      // logic modules and the two components with a real history of bugs are.
      include: ['src/lib/**', 'src/components/forms/**', 'src/components/quiz/**'],
      // Static copy and a type-only re-export: nothing to execute, so counting
      // them only dilutes the figure.
      exclude: [
        'src/lib/siteStrings.ts',
        'src/lib/translations.ts',
        'src/lib/game/strings.ts',
        'src/lib/game/hostStrings.ts',
        'src/lib/game/playerStrings.ts',
        // Pure browser effects (synthesised audio, a canvas animation): there
        // is no logic to assert on, only output a person hears or sees.
        'src/lib/game/sound.ts',
        'src/lib/game/confetti.ts',
        'src/**/*.test.{ts,tsx}',
      ],
      // Floors for CI (`npm run test:coverage`), not targets: raise them as
      // coverage grows, never lower them to turn a red build green.
      thresholds: {
        statements: 70,
        branches: 75,
        functions: 60,
        lines: 70,
      },
    },
  },
});
