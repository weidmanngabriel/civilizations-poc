import type { World } from "../simulation/model";
import {
  IMPLEMENTED_TECHNOLOGIES,
  technologyProgress,
} from "../simulation/technology";

/**
 * Runs configuration paths that the player-facing UI evaluates during startup.
 * Keep this deterministic and browser-independent so CI can catch broken domain
 * configuration before a bundle is deployed.
 */
export function validateStartupConfiguration(world: World): void {
  for (const technology of IMPLEMENTED_TECHNOLOGIES)
    technologyProgress(world, technology);
}
