# Testing

This file is the primary location for the project-specific test strategy and the mapping of behavior to test types.

Desktop and touch interactions must be tested together whenever either input model changes; optimizing one must not silently degrade the other.

Every newly introduced building profession requires a regression test covering the full path **set profession → find valid workplace → assign workplace**. A successful TypeScript build alone is not sufficient coverage.

## Housing coverage

Housing tests cover the apartment counts of all five residential levels, cumulative direct-build costs, next-level upgrade costs, the one-household-per-apartment capacity invariant, moving an existing household between houses, and exclusion of full houses from valid home targets. Save/load tests use the current save version so household state remains part of the authoritative JSON roundtrip. Wiki tests cover the residential rules and all five level rows.

