# Documentation

This file defines how project documentation is organized and maintained.

- [`docs/architecture.md`](./docs/architecture.md) is the primary location for the current technical system structure. Update it when that structure changes; historical rationale belongs in ADRs.
- [`docs/concept.md`](./docs/concept.md) is the primary location for functions, features, and externally observable behavior. Update it when product behavior changes.
- [`docs/domain.md`](./docs/domain.md) is the primary location for domain terms, domain rules, invariants, value ranges, and state transitions. Update it only when reliable domain information changes; do not treat code alone as proof of a domain rule.
- [`docs/testing.md`](./docs/testing.md) is the primary location for the project-specific test strategy and mapping of behavior to test types. Update it when that strategy changes.
- [`docs/development.md`](./docs/development.md) is the primary location for project-specific development and repository workflow rules. Update it when those rules change.
- [`docs/decisions/`](./docs/decisions/README.md) stores ADRs for the rationale behind significant architectural decisions.

Before implementation, read the documents relevant to the planned change. Product-facing changes require `concept.md`; technical changes require `architecture.md`; domain changes require `domain.md`; test-strategy changes require `testing.md`; repository-workflow changes require `development.md`.

Documentation is updated together with the related code change, only where affected. Do not add information speculatively, silently resolve contradictions between code and documentation, overwrite maintained rationale or domain rules without cause, or duplicate information unnecessarily. Leave topics empty until reliable project-specific information exists.
