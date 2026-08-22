import type { User } from "firebase/auth";
import {
  isSlideConflictResponse,
  isSlideLimitResponse,
  isSlideListResponse,
  isSlideResponse,
  type SlideSummary,
} from "../../lib/slides/api-response.ts";

type AuthenticatedUser = Pick<User, "getIdToken">;

export type SlideCreationOutcome =
  | { kind: "created"; slide: SlideSummary }
  | { kind: "limit"; limit: number };

export type SlideUpdateOutcome =
  | { kind: "updated"; slide: SlideSummary }
  | { kind: "conflict"; slide: SlideSummary };

function slidesEndpoint(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/slides`;
}

function slideEndpoint(workspaceId: string, slideId: string): string {
  return `${slidesEndpoint(workspaceId)}/${encodeURIComponent(slideId)}`;
}

async function authorizationHeaders(
  user: AuthenticatedUser,
): Promise<HeadersInit> {
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export async function requestSlides(
  user: AuthenticatedUser,
  workspaceId: string,
): Promise<SlideSummary[]> {
  const response = await fetch(slidesEndpoint(workspaceId), {
    headers: await authorizationHeaders(user),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isSlideListResponse(body)) return body.slides;
  throw new Error("QRousel could not load your slides.");
}

export async function requestSlideCreation(
  user: AuthenticatedUser,
  workspaceId: string,
  input: { title: string; description: string },
): Promise<SlideCreationOutcome> {
  const response = await fetch(slidesEndpoint(workspaceId), {
    method: "POST",
    headers: {
      ...(await authorizationHeaders(user)),
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isSlideResponse(body)) {
    return { kind: "created", slide: body.slide };
  }
  if (response.status === 409 && isSlideLimitResponse(body)) {
    return { kind: "limit", limit: body.limit };
  }
  throw new Error("QRousel could not create this slide.");
}

export async function requestSlideUpdate(
  user: AuthenticatedUser,
  workspaceId: string,
  slideId: string,
  input: { title: string; description: string; expectedVersion: number },
): Promise<SlideUpdateOutcome> {
  const response = await fetch(slideEndpoint(workspaceId, slideId), {
    method: "PATCH",
    headers: {
      ...(await authorizationHeaders(user)),
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isSlideResponse(body)) {
    return { kind: "updated", slide: body.slide };
  }
  if (response.status === 409 && isSlideConflictResponse(body)) {
    return { kind: "conflict", slide: body.slide };
  }
  throw new Error("QRousel could not save this slide.");
}
