# Development

This file contains the project-specific development and repository workflow rules that do not belong to architecture, product behavior, domain rules, testing strategy, or ADRs.

Keep solutions as small and understandable as possible. Prefer simple, established solutions over complex architectures. Make reasonable technical decisions independently within the documented constraints. If a product function is not yet defined, do not invent extensive domain logic; create a clean foundation instead.

For player-facing changes, check whether the in-app handbook under `src/handbook/*.md` must be updated. Player-facing handbook content stays concise, player-centered, and free of internal implementation details or unnecessary balance numbers.

Documentation should let a capable Coding Agent understand the application and its important product and architecture decisions quickly enough to reconstruct the system at a high level.

Changes are implemented on a temporary branch; intermediate commits are allowed. Do not open a pull request while implementation is still in progress. First complete the intended code, tests and documentation on the temporary branch. Only when that branch is ready for final validation, open a pull request against `main`.

Opening or updating that pull request automatically runs full validation through GitHub Actions. The pull-request run must pass both `npm test` and `npm run build`. If fixes are required after the pull request is open, push them to the same temporary branch; the `synchronize` event reruns validation and supersedes the older run. No commits may be added after the final successful validation, and the validated commit SHA must exactly match the PR head that is merged.

At the end of a run, squash-merge the change into `main` so exactly one meaningful commit remains for that adjustment. A push to `main` runs tests and build again and deploys GitHub Pages only when both succeed. Manual workflow runs do not deploy. After the squash merge, verify build and deployment status; fixes use a new temporary branch and another single squash commit.

For changes to map scale, terrain, building sizes or placement, resident rendering or scaling, natural resources, loose goods, pathfinding, roads, or resource logistics, also read [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](../FINE_GRID_RESOURCE_REWORK_PLAN.md). If another major redesign of these systems begins, explicitly reopen that plan or create a new active plan.
