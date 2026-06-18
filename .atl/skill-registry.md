# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements. | vercel-react-best-practices | D:/Archivos personales/Codigo/NEWLAB/.agents/skills/vercel-react-best-practices/SKILL.md |
| UI structure, visual styling, layout, accessibility, responsive behavior, interaction states, dashboards, modals, forms, cards, tables, charts, navigation, or design-system decisions | ui-ux-pro-max | D:/Archivos personales/Codigo/NEWLAB/.agents/skills/ui-ux-pro-max-skill |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### vercel-react-best-practices
- Move await into branches where actually used (`async-defer-await`)
- Use Promise.all() for independent async operations (`async-parallel`)
- Import directly from modules, avoid barrel files to reduce bundle size (`bundle-barrel-imports`)
- Don't subscribe to state only used in callbacks (`rerender-defer-reads`)
- Subscribe to derived booleans, not raw values, and derive state during render instead of effects (`rerender-derived-state-no-effect`)
- Use functional setState for stable callbacks (`rerender-functional-setstate`)
- Use startTransition for non-urgent UI updates (`rerender-transitions`)
- Animate div wrappers instead of direct SVG elements for better rendering performance (`rendering-animate-svg-wrapper`)
- Extract static JSX outside components (`rendering-hoist-jsx`)
- Use early exits and Map for repeated lookups (`js-early-exit`, `js-index-maps`)

### ui-ux-pro-max
- Focus on UX/design guidance without rewriting backend business logic.
- Verify existing CSS classes (`.btn`, `.card`, etc.) to prevent styling regressions on shared surfaces.
- Support both dark and light modes cleanly using CSS variables and modern curated color palettes.
- Apply high-end aesthetics (vibrant colors, glassmorphism, responsive designs, micro-animations).
- Every non-trivial UI change must consider accessibility, mobile/responsive layout, and hover/focus states.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | D:/Archivos personales/Codigo/NEWLAB/AGENTS.md | Main project conventions index file |
| DEPLOYMENT.md | D:/Archivos personales/Codigo/NEWLAB/DEPLOYMENT.md | Build and deploy patterns |
| ROLLBACK.md | D:/Archivos personales/Codigo/NEWLAB/ROLLBACK.md | Rollback procedures |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
