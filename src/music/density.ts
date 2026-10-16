/**
 * Pattern density: a per-track control that thins a part musically.
 * Each event gets an importance score (its velocity plus a bonus for sitting
 * on a beat or an eighth); lowering density removes the least important
 * events first, so ghost notes and soft offbeats go before downbeats.
 */
import { mod } from './theory';

export function eventImportance(t: number, v: number): number {
  const pos = mod(t, 16);
  const onBeat = Math.abs(pos % 4) < 1e-6;
  const onEighth = Math.abs(pos % 2) < 1e-6;
  return v + (onBeat ? 0.3 : onEighth ? 0.1 : 0);
}

export function keepAtDensity(density: number, t: number, v: number): boolean {
  if (density >= 0.999) return true;
  return eventImportance(t, v) >= (1 - density) * 1.2;
}
