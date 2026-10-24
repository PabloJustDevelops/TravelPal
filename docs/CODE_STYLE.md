# Code style

- TypeScript strict wherever possible.
- Descriptive, consistent names.
- No unnecessary comments; document the decisions that are not obvious from the code.
- Small, reusable components.
- Shared helpers live in `src/lib/utils.ts`.
- Follow the ESLint configuration in `eslint.config.mjs`; run `pnpm run lint`.

Formatting is enforced by ESLint (`eslint-config-next`); the repository has no separate Prettier
configuration, so `pnpm exec eslint --fix` is the formatter.
