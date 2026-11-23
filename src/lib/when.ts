// Month and time of day for a sighting, worked out from its date and time in India (IST).

const IST = "Asia/Kolkata";

/** "November" */
export function monthOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "long", timeZone: IST });
}

/** The hour (0–23) in India. */
function istHour(iso: string) {
  const h = new Date(iso).toLocaleString("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: IST });
  return Number(h);
}

/** Dawn 5–7, Morning 7–11, Midday 11–2, Afternoon 2–5, Dusk 5–7, Night 7–5. */
export function timeOfDayOf(iso: string) {
  const h = istHour(iso);
  if (h >= 5 && h < 7) return "Dawn";
  if (h >= 7 && h < 11) return "Morning";
  if (h >= 11 && h < 14) return "Midday";
  if (h >= 14 && h < 17) return "Afternoon";
  if (h >= 17 && h < 19) return "Dusk";
  return "Night";
}

/** Quick choices offered in the Weather box (people can still type anything). */
export const WEATHER_CHOICES = [
  "Clear",
  "Sunny",
  "Partly cloudy",
  "Cloudy",
  "Misty",
  "Foggy",
  "Light rain",
  "Heavy rain",
  "Windy",
  "Hot",
  "Cold",
] as const;
