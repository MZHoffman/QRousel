export type DeckSlide = {
  id: string;
  slideId: string;
  title: string;
  description: string;
  qrCodeId: string | null;
  qrCodeName: string | null;
  position: number;
  displayDurationSeconds: number | null;
};

export function isDeckSlideListResponse(value: unknown): value is { slides: DeckSlide[] } {
  return typeof value === "object" && value !== null && "slides" in value && Array.isArray(value.slides) && value.slides.every((slide) => typeof slide === "object" && slide !== null && "id" in slide && typeof slide.id === "string" && "slideId" in slide && typeof slide.slideId === "string" && "title" in slide && typeof slide.title === "string" && "description" in slide && typeof slide.description === "string" && "qrCodeId" in slide && (slide.qrCodeId === null || typeof slide.qrCodeId === "string") && "qrCodeName" in slide && (slide.qrCodeName === null || typeof slide.qrCodeName === "string") && "position" in slide && Number.isSafeInteger(slide.position) && "displayDurationSeconds" in slide && (slide.displayDurationSeconds === null || Number.isSafeInteger(slide.displayDurationSeconds)));
}
