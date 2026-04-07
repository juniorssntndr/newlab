## Code Review Rules

- Use conventional commits only.
- Never add AI attribution to commits.
- Prefer small, safe frontend changes over broad rewrites.
- Preserve business logic unless the task explicitly requires changing it.
- For React changes, keep components composable and avoid duplicating state ownership.
- For styling changes, prefer scoped selectors and avoid regressions across shared surfaces.

## Focus Areas

- Validate JSX/JS consistency and avoid obvious runtime issues.
- Watch for CSS regressions in shared composer/modal layouts.
- Flag payload/state drift between UI and derived order data.
