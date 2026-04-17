## Code Review Rules

- Use conventional commits only.
- Never add AI attribution to commits.
- Prefer small, safe frontend changes over broad rewrites.
- Preserve business logic unless the task explicitly requires changing it.
- For React changes, keep components composable and avoid duplicating state ownership.
- For styling changes, prefer scoped selectors and avoid regressions across shared surfaces.

## Skills Auto-load

Load the relevant skill before changing behavior or code in these contexts:

| Context | Skill |
| ------- | ----- |
| UI structure, visual styling, layout, accessibility, responsive behavior, interaction states, dashboards, modals, forms, cards, tables, charts, navigation, or design-system decisions | `ui-ux-pro-max` |
| React component structure, render behavior, state ownership, effects, memoization, bundle/performance-sensitive frontend work | `vercel-react-best-practices` |
| Browser automation, visual smoke checks, screenshots, interaction validation, or end-to-end UI flow checks | `playwright-skill` |

## UI/UX Pro Max Policy

- Treat `ui-ux-pro-max` as UX/design guidance, not as permission to rewrite business logic.
- NEWLAB frontend is React + Vite with an existing CSS system; do not assume Tailwind or shadcn/ui unless the project configuration proves it.
- Preserve state ownership, payload shape, derived order data, and business behavior before improving visuals.
- Prefer page-scoped or component-scoped selectors for UI changes; assess regression risk before editing shared classes such as `.btn`, `.card`, `.form-*`, `.data-table`, composer, modal, sidebar, or header styles.
- Every non-trivial UI change must explicitly consider accessibility, responsive behavior, interaction states, visual consistency, and perceived performance.
- For SDD changes, apply `ui-ux-pro-max` during proposal/design/spec/verify so UX decisions become verifiable scenarios, not vague taste.

## Focus Areas

- Validate JSX/JS consistency and avoid obvious runtime issues.
- Watch for CSS regressions in shared composer/modal layouts.
- Flag payload/state drift between UI and derived order data.
