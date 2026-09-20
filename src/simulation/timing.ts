export const SIMULATION_HZ = 60;

export const MIN_SIMULATION_SPEED = 0.1;
export const MAX_SIMULATION_SPEED = 10;

export const normalizeSimulationSpeed = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.max(MIN_SIMULATION_SPEED, Math.min(MAX_SIMULATION_SPEED, value));
  return Math.round(clamped * 10) / 10;
};

export const isValidSimulationSpeed = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= MIN_SIMULATION_SPEED &&
  value <= MAX_SIMULATION_SPEED &&
  Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
