# Testing

This file is the primary location for the project-specific test strategy and the mapping of behavior to test types.

Desktop and touch interactions must be tested together whenever either input model changes; optimizing one must not silently degrade the other.

Every newly introduced building profession requires a regression test covering the full path **set profession → find valid workplace → assign workplace**. A successful TypeScript build alone is not sufficient coverage.
