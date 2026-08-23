export const ICON_LIMIT = 100;
export const MAX_ICON_BYTES = 900_000;

export type IconCreationDecision =
  | { kind: "create"; name: string; imageDataUrl: string; nextIconCount: number }
  | { kind: "limit"; limit: number };

export function decideIconCreation(input: { iconCount: number; requestedName: string; imageDataUrl: string }): IconCreationDecision {
  if (!Number.isSafeInteger(input.iconCount) || input.iconCount < 0) throw new Error("The icon resource counter is invalid.");
  const name = input.requestedName.trim();
  if (!name) throw new Error("An icon name is required.");
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(input.imageDataUrl)) throw new Error("A cropped icon image is required.");
  if (input.imageDataUrl.length > MAX_ICON_BYTES * 1.4) throw new Error("The cropped icon is too large.");
  if (input.iconCount >= ICON_LIMIT) return { kind: "limit", limit: ICON_LIMIT };
  return { kind: "create", name, imageDataUrl: input.imageDataUrl, nextIconCount: input.iconCount + 1 };
}
