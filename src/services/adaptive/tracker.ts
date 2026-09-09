export const DIFFICULTY_TARGET = 0.85
export const UNASSISTED_TARGET = 0.7

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

export function track(
  parameter: number,
  observed: number,
  target: number,
  alpha: number,
  lo: number,
  hi: number,
): number {
  if (!Number.isFinite(observed)) return parameter
  return clamp(parameter + alpha * (observed - target), lo, hi)
}

export function quantile(values: number[], probability: number): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const position = (sorted.length - 1) * clamp(probability, 0, 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}