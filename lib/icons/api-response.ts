export type IconSummary = { id: string; name: string; imageDataUrl: string };
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function icon(value: unknown): value is IconSummary { return record(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.imageDataUrl === "string"; }
export function isIconListResponse(value: unknown): value is { icons: IconSummary[] } { return record(value) && Array.isArray(value.icons) && value.icons.every(icon); }
export function isIconResponse(value: unknown): value is { icon: IconSummary } { return record(value) && icon(value.icon); }
export function isIconLimitResponse(value: unknown): value is { status: "limit_reached"; limit: number } { return record(value) && value.status === "limit_reached" && Number.isSafeInteger(value.limit); }
