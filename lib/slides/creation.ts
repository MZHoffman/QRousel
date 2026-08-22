export const SLIDE_LIMIT = 500;

export type SlideCreationDecision =
  | {
      kind: "create";
      title: string;
      description: string;
      nextSlideCount: number;
    }
  | { kind: "limit"; limit: number };

type SlideCreationInput = {
  slideCount: number;
  requestedTitle: string;
  requestedDescription: string;
};

export function decideSlideCreation({
  slideCount,
  requestedTitle,
  requestedDescription,
}: SlideCreationInput): SlideCreationDecision {
  if (!Number.isSafeInteger(slideCount) || slideCount < 0) {
    throw new Error("The slide resource counter is invalid.");
  }

  const title = requestedTitle.trim();
  if (title.length === 0) {
    throw new Error("A slide title is required.");
  }

  if (slideCount >= SLIDE_LIMIT) {
    return { kind: "limit", limit: SLIDE_LIMIT };
  }

  return {
    kind: "create",
    title,
    description: requestedDescription.trim(),
    nextSlideCount: slideCount + 1,
  };
}
