import { getHealthReadWorkoutsEnabled } from "../../db/queries";
import { fetchRecentWorkoutMetrics, type HealthMetrics } from "../../health";

/**
 * Apple Health stats for a session that just finished, or null when the user
 * has turned "Read workouts" off. Null (rather than empty metrics) lets the
 * summary drop its Health section instead of showing dashes and a hint to
 * enable access the user deliberately switched off. Reading is skipped
 * entirely when off, so it can't surface the iOS permission sheet either.
 */
export async function readSessionHealthMetrics(): Promise<HealthMetrics | null> {
  if (!(await getHealthReadWorkoutsEnabled())) return null;
  return fetchRecentWorkoutMetrics();
}
