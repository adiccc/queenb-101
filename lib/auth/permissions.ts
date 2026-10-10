// The shared access code currently grants these permissions to all valid groups.
export const permissions = ["teacher:enter", "data:write", "images:generate"] as const;
export type Permission = typeof permissions[number];
