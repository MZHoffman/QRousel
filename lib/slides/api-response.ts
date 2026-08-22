export type SlideSummary = {
  id: string;
  title: string;
  description: string;
  version: number;
};

export type SlideListResponse = { slides: SlideSummary[] };
export type SlideResponse = { slide: SlideSummary };
export type SlideLimitResponse = { status: "limit_reached"; limit: number };
export type SlideConflictResponse = { status: "conflict"; slide: SlideSummary };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slide(value: unknown): value is SlideSummary {
  return (
    record(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.description === "string" &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) > 0
  );
}

export function isSlideListResponse(value: unknown): value is SlideListResponse {
  return record(value) && Array.isArray(value.slides) && value.slides.every(slide);
}
export function isSlideResponse(value: unknown): value is SlideResponse {
  return record(value) && slide(value.slide);
}
export function isSlideLimitResponse(value: unknown): value is SlideLimitResponse {
  return (
    record(value) &&
    value.status === "limit_reached" &&
    Number.isSafeInteger(value.limit) &&
    Number(value.limit) > 0
  );
}

export function isSlideConflictResponse(
  value: unknown,
): value is SlideConflictResponse {
  return record(value) && value.status === "conflict" && slide(value.slide);
}
