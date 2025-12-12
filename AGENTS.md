# Repository Guidelines

## Project Structure & Module Organization

- Next.js 16 app router lives in `app/` (`page.tsx`, nested routes, and `api/` endpoints). Global styles are in `app/globals.css`.
- Reusable UI and feature components sit in `components/` (Kanban board, issue modals, filters). Shared primitives are under `components/ui/`.
- Client/server helpers and hooks are under `lib/` (Jira API wrappers, toasts, paste-image support). Types reside in `types/`.
- Static assets live in `public/`. Config roots: `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `prettier.config.js`.

## Build, Test, and Development Commands

- Install deps: `bun install` (preferred, lockfile present) or `npm install`.
- Local dev: `bun run dev` (Next dev server at http://localhost:3000).
- Production build: `bun run build`; serve with `bun run start`.
- Linting only: `bun run lint`.
- Format all files: `bun run format`; check-only: `bun run format:check`.

## Coding Style & Naming Conventions

- TypeScript + React (Server Components where possible, Client Components marked with `"use client"`).
- Styling via Tailwind (see utility classes in components) with Prettier + `prettier-plugin-tailwindcss`; run format before pushing.
- Prefer async/await, early returns, and small, focused components. Keep props typed and pass data, not JSX fragments, through hooks.
- Naming: components in `PascalCase`, hooks in `camelCase` prefixed with `use`, constants in `SCREAMING_SNAKE_CASE`.

## Testing Guidelines

- No dedicated test suite is present; add lightweight unit or integration tests alongside features when practical.
- If adding tests, mirror the module path (e.g., `components/issue-card.test.tsx`) and keep them deterministic. Aim for coverage on Jira API calls and board interactions.

## Commit & Pull Request Guidelines

- Commit messages are short, imperative summaries (`fix: images load inline`, `feat: WIP paste image`). Follow that style.
- PRs should describe intent, scope, and user-facing impact. Link Jira tickets/issues and include screenshots or Looms for UI changes (especially board, modals, and auth flows).
- Note any new env vars or breaking changes in the PR description.

## Environment & Security Notes

- Jira auth supports Atlassian OAuth 3LO; set `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET`, and `ATLASSIAN_REDIRECT_URI`. Basic auth fallbacks (`JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BASE_URL`) are for local use only.
- Do not commit secrets; use `.env.local` for development. Validate redirects when adding routes under `app/api/auth/jira`.
