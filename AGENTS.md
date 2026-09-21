# Documentation

This file defines how project documentation is organized and maintained.

- [`docs/architecture.md`](./docs/architecture.md) is the primary location for the current technical system structure. Update it when that structure changes; historical rationale belongs in ADRs.
- [`docs/concept.md`](./docs/concept.md) is the primary location for functions, features, and externally observable behavior. Update it when product behavior changes.
- [`docs/domain.md`](./docs/domain.md) is the primary location for domain terms, domain rules, invariants, value ranges, and state transitions. Update it only when reliable domain information changes; do not treat code alone as proof of a domain rule.
- [`docs/testing.md`](./docs/testing.md) is the primary location for the project-specific test strategy and mapping of behavior to test types. Update it when that strategy changes.
- [`docs/decisions/`](./docs/decisions/README.md) stores ADRs for the rationale behind significant architectural decisions.

Documentation is updated together with the related code change, only where affected. Do not add information speculatively, silently resolve contradictions between code and documentation, overwrite maintained rationale or domain rules without cause, or duplicate information unnecessarily. Leave topics empty until reliable project-specific information exists.
