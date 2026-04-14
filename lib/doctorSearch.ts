import { filterDoctors } from "@/lib/search";
import type { SearchResponse } from "@/lib/types";

export async function findDoctors(
  mutua: string,
  especialidad: string,
  cp: string,
  maxKm?: number
): Promise<SearchResponse> {
  const doctors = await filterDoctors(mutua, especialidad, cp, maxKm);
  return { doctors };
}
