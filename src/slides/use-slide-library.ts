import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { SlideSummary } from "../../lib/slides/api-response";
import {
  requestSlideCreation,
  requestSlideUpdate,
  requestSlides,
} from "./slide-client";

type SlideLibraryState =
  | { kind: "loading"; workspaceId: string }
  | { kind: "ready"; workspaceId: string; slides: SlideSummary[] }
  | { kind: "error"; workspaceId: string; message: string };

export function useSlideLibrary(user: User, workspaceId: string) {
  const [state, setState] = useState<SlideLibraryState>({
    kind: "loading",
    workspaceId,
  });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let current = true;
    void requestSlides(user, workspaceId).then(
      (slides) => {
        if (current) setState({ kind: "ready", workspaceId, slides });
      },
      (error: unknown) => {
        if (!current) return;
        setState({
          kind: "error",
          workspaceId,
          message:
            error instanceof Error
              ? error.message
              : "QRousel could not load your slides.",
        });
      },
    );
    return () => {
      current = false;
    };
  }, [reloadVersion, user, workspaceId]);

  const currentState =
    state.workspaceId === workspaceId
      ? state
      : { kind: "loading" as const, workspaceId };

  function replaceSlide(slide: SlideSummary) {
    setState((current) => ({
      kind: "ready",
      workspaceId,
      slides:
        current.kind === "ready" && current.workspaceId === workspaceId
          ? current.slides.map((item) => (item.id === slide.id ? slide : item))
          : [slide],
    }));
  }

  async function create(input: { title: string; description: string }) {
    if (isSaving) return false;
    setIsSaving(true);
    setSaveError("");
    try {
      const result = await requestSlideCreation(user, workspaceId, input);
      if (result.kind === "limit") {
        setSaveError(`This workspace can contain up to ${result.limit} slides.`);
        return false;
      }
      setState((current) => ({
        kind: "ready",
        workspaceId,
        slides:
          current.kind === "ready" && current.workspaceId === workspaceId
            ? [result.slide, ...current.slides]
            : [result.slide],
      }));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "QRousel could not create this slide.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function update(
    slide: SlideSummary,
    input: { title: string; description: string },
  ): Promise<
    | { kind: "updated" }
    | { kind: "conflict"; slide: SlideSummary }
    | { kind: "error" }
  > {
    if (isSaving) return { kind: "error" };
    setIsSaving(true);
    setSaveError("");
    try {
      const result = await requestSlideUpdate(user, workspaceId, slide.id, {
        ...input,
        expectedVersion: slide.version,
      });
      replaceSlide(result.slide);
      return result.kind === "conflict"
        ? { kind: "conflict", slide: result.slide }
        : { kind: "updated" };
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "QRousel could not save this slide.",
      );
      return { kind: "error" };
    } finally {
      setIsSaving(false);
    }
  }

  return {
    state: currentState,
    slides: currentState.kind === "ready" ? currentState.slides : [],
    isSaving,
    saveError,
    clearSaveError: () => setSaveError(""),
    create,
    update,
    retry: () => {
      setState({ kind: "loading", workspaceId });
      setReloadVersion((version) => version + 1);
    },
  };
}
