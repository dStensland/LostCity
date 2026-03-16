/** Shared adventure weather assessment logic. */

export function getAdventureAssessment(temp: number, condition: string, windSpeed: number): string {
  const lower = condition.toLowerCase();
  if (lower.includes("thunder") || lower.includes("storm")) return "Stay close to town";
  if (lower.includes("rain") || lower.includes("shower")) return "Waterfall conditions";
  if (lower.includes("snow") || lower.includes("freez")) return "Cold-weather trails";
  if (temp >= 95) return "Early starts only";
  if (temp >= 85 && windSpeed < 5) return "Hot — seek shade and water";
  if (temp >= 70 && temp <= 85 && (lower.includes("clear") || lower.includes("sunny"))) return "Great day for a hike";
  if (temp >= 50 && temp <= 70) return "Perfect trail conditions";
  if (temp < 40) return "Bundle up out there";
  if (windSpeed > 20) return "Windy — avoid exposed ridges";
  return "Decent conditions";
}
