export interface DateOverride {
  date: string; // YYYY-MM-DD format
  type: "unavailable" | "custom";
  slots?: Array<{ startTime: string; endTime: string }>;
}

export function getEffectiveDayConfig(
  targetDateStr: string, // YYYY-MM-DD in host timezone
  weekdayName: string,   // e.g. "Monday"
  weeklyAvailability: Array<{ day: string; enabled: boolean; slots: Array<{ startTime: string; endTime: string }> }> | null,
  overrides: DateOverride[] | null
): { enabled: boolean; slots: Array<{ startTime: string; endTime: string }> } {
  // Check if there is an explicit override for this specific date
  if (overrides && Array.isArray(overrides)) {
    const override = overrides.find((o) => o.date === targetDateStr);
    if (override) {
      if (override.type === "unavailable") {
        return { enabled: false, slots: [] };
      } else if (override.type === "custom") {
        return { enabled: true, slots: override.slots || [] };
      }
    }
  }

  // Fall back to recurring weekly schedule
  if (!weeklyAvailability || !Array.isArray(weeklyAvailability)) {
    return { enabled: false, slots: [] };
  }

  const dayConfig = weeklyAvailability.find((a) => a.day === weekdayName);
  if (!dayConfig || !dayConfig.enabled) {
    return { enabled: false, slots: [] };
  }

  return { enabled: true, slots: dayConfig.slots || [] };
}
