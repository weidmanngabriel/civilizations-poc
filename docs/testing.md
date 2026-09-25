# Testing

This file is the primary location for the project-specific test strategy and the mapping of behavior to test types.

Desktop and touch interactions must be tested together whenever either input model changes; optimizing one must not silently degrade the other.

Every newly introduced building profession requires a regression test covering the full path **set profession → find valid workplace → assign workplace**. A successful TypeScript build alone is not sufficient coverage.

## Housing coverage

Housing tests cover the apartment counts of all five residential levels, cumulative direct-build costs, next-level upgrade costs, the one-household-per-apartment capacity invariant, moving an existing household between houses, and exclusion of full houses from valid home targets. Save/load tests use the current save version so household state remains part of the authoritative JSON roundtrip. Wiki tests cover the residential rules and all five level rows.


## Startup integrity

Startup-sensitive domain configuration must be exercised through `validateStartupConfiguration()` in Node tests. In particular, every implemented technology must resolve all construction prerequisites without throwing. This prevents a data/configuration change from breaking a UI module only when the browser starts.

Every full CI validation also runs `npm run smoke:startup` after the production build. The smoke script serves `dist`, opens the real built game in headless Chrome/Chromium, connects through the Chrome DevTools Protocol, and succeeds only when the live document reaches `data-game-ready="true"` with a game canvas present. It terminates the browser explicitly after the assertion, so the game's continuous animation loop cannot make CI hang. A fatal crash marker, browser failure, timeout, or incomplete startup fails the workflow and therefore blocks GitHub Pages deployment.
