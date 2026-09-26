# Testing

This file is the primary location for the project-specific test strategy and the mapping of behavior to test types.

Desktop and touch interactions must be tested together whenever either input model changes; optimizing one must not silently degrade the other.

Every newly introduced building profession requires a regression test covering the full path **set profession → find valid workplace → assign workplace**. A successful TypeScript build alone is not sufficient coverage.

## Housing coverage

Housing tests cover the apartment counts of all five residential levels, cumulative direct-build costs, next-level upgrade costs, the one-household-per-apartment capacity invariant, moving an existing household between houses, and exclusion of full houses from valid home targets. Save/load tests use the current save version so household state remains part of the authoritative JSON roundtrip. Wiki tests cover the residential rules and all five level rows. Technology tests cover the material-producer prerequisites for all five house levels and verify that removing prerequisite buildings cannot revoke a previously unlocked level.

Browser-save tests lock the five-real-minute autosave cadence, the three fixed rolling autosave slots, the separate crash-save slot and the rule that automatic saves are distinct from manual save identity.


## Startup integrity

Startup-sensitive domain configuration must be exercised through `validateStartupConfiguration()` in Node tests. In particular, every implemented technology must resolve all construction prerequisites without throwing. This prevents a data/configuration change from breaking a UI module only when the browser starts.

Every full CI validation also runs `npm run smoke:startup` after the production build. The smoke script serves `dist`, opens the real built game in headless Chrome/Chromium, connects through the Chrome DevTools Protocol, and succeeds only when the live document reaches `data-game-ready="true"` with a game canvas present. It terminates the browser explicitly after the assertion, so the game's continuous animation loop cannot make CI hang. A fatal crash marker, browser failure, timeout, or incomplete startup fails the workflow and therefore blocks GitHub Pages deployment.

## Family coverage

Family tests lock the low/medium/high birth cadence, the 90/9/1 multiple-birth thresholds, symmetric partner search and marriage, household merging for one or two existing apartments, close-relative exclusions, the 2.5-minute visual-stage transition, five-minute adulthood transition, automatic departure from the parental household without rehousing, and rejection of manual child movement. Save/load and wiki tests cover the new persistent family state and documented player-facing rules.

