export const groupsByRegion = {
  "צפון": [111, 112, 113, 114, 115],
  "דרום": [711, 712, 713, 715, 716, 721],
  "שרון": [311, 312],
  "חיפה": [211, 212, 213, 214, 215],
  "ירושלים": [611, 612, 613, 614, 616],
  "מרכז": [511, 512, 513, 514, 515, 531],
  "תל אביב והסביבה": [411, 412, 413, 414, 415],
} as const;
export type Region = keyof typeof groupsByRegion;
const regions = new Map<string, Region>(Object.entries(groupsByRegion).flatMap(([region, ids]) => ids.map(id => [String(id), region as Region])));
export const isGroupId = (value: unknown): value is string => typeof value === "string" && regions.has(value);
export const regionForGroup = (id: string) => regions.get(id);
export function groupDataKey(groupId: string) {
  if (!isGroupId(groupId)) throw new Error("Unknown group");
  return `groups/${groupId}/data.json`;
}
