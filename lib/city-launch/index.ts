/** Binds the generated Census dataset to the pure City Launch helpers (server + client safe). */
import { US_CITIES_META, US_CITY_ROWS, US_STATE_ROWS } from "./us-cities.generated";
import { createCityIndex, type CityIndex } from "./cities";

let cached: CityIndex | null = null;

export function getUsCityIndex(): CityIndex {
  if (!cached) cached = createCityIndex(US_CITY_ROWS, US_STATE_ROWS);
  return cached;
}

export { US_CITIES_META };
export * from "./cities";
