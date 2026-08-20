import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Slide = {
  id: string;
  title: string;
  description: string;
  image: string;
  fileName: string;
};

const SLIDE_DURATION = 15000;
const STORAGE_URL = "http://127.0.0.1:3001";

export default function App() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [imageIsNew, setImageIsNew] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    startedAt.current = Date.now();
    setProgress(0);
  }, []);

  useEffect(() => {
    async function loadSlides() {
      try {
        const response = await fetch(`${STORAGE_URL}/slides`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to read saved slides.");
        const savedSlides = (await response.json()) as Slide[];
        setSlides(savedSlides);
        setIsFormOpen(savedSlides.length === 0);
      } catch {
        setSaveError(
          "Local storage is not running. Restart the app with npm run dev.",
        );
        setIsFormOpen(true);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSlides();
  }, []);

  useEffect(() => {
    if (slides.length === 0 || isFormOpen) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (startedAt.current === null) startedAt.current = now;
      const elapsed = now - startedAt.current;
      const nextProgress = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(nextProgress);

      if (elapsed >= SLIDE_DURATION) {
        setCurrentIndex((index) => (index + 1) % slides.length);
        startedAt.current = now;
        setProgress(0);
      }
    }, 40);

    return () => window.clearInterval(timer);
  }, [slides.length, isFormOpen]);

  useEffect(() => {
    startedAt.current = Date.now();
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0 || isFormOpen) return;

    function handleArrowKeys(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      setCurrentIndex((index) =>
        event.key === "ArrowRight"
          ? (index + 1) % slides.length
          : (index - 1 + slides.length) % slides.length,
      );
      resetTimer();
    }

    window.addEventListener("keydown", handleArrowKeys);
    return () => window.removeEventListener("keydown", handleArrowKeys);
  }, [slides.length, isFormOpen, resetTimer]);

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setFileName(file.name);
      setImageIsNew(true);
    };
    reader.readAsDataURL(file);
  }

  function resetEditor() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setImage("");
    setImageIsNew(false);
    setFileName("");
    setSaveError("");
  }

  function closeManager() {
    resetEditor();
    setIsFormOpen(false);
  }

  function beginEdit(slide: Slide) {
    setEditingId(slide.id);
    setTitle(slide.title);
    setDescription(slide.description);
    setImage(slide.image);
    setImageIsNew(false);
    setFileName(slide.fileName);
    setSaveError("");
  }

  async function saveSlide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image || !title.trim() || !description.trim() || isSaving) return;

    setIsSaving(true);
    setSaveError("");
    try {
      const isEditing = editingId !== null;
      const response = await fetch(
        isEditing
          ? `${STORAGE_URL}/slides/${encodeURIComponent(editingId)}`
          : `${STORAGE_URL}/slides`,
        {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          ...(imageIsNew ? { image, fileName } : {}),
        }),
      });
      const result = (await response.json()) as Slide & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save slide.");

      if (isEditing) {
        const editedIndex = slides.findIndex((slide) => slide.id === editingId);
        setSlides((items) =>
          items.map((slide) => (slide.id === editingId ? result : slide)),
        );
        if (editedIndex !== -1) setCurrentIndex(editedIndex);
      } else {
        setSlides((items) => [...items, result]);
        setCurrentIndex(slides.length);
      }
      resetEditor();
      setIsFormOpen(false);
      resetTimer();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save slide.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSlide(id: string) {
    const removedIndex = slides.findIndex((slide) => slide.id === id);
    if (removedIndex === -1) return;

    setSaveError("");
    try {
      const response = await fetch(
        `${STORAGE_URL}/slides/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to remove slide.");

      const remaining = slides.filter((slide) => slide.id !== id);
      setSlides(remaining);
      if (editingId === id) resetEditor();
      setCurrentIndex((index) => {
        if (remaining.length === 0) return 0;
        if (index > removedIndex) return index - 1;
        return Math.min(index, remaining.length - 1);
      });
      resetTimer();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to remove slide.",
      );
    }
  }

  const currentSlide = slides[currentIndex];
  const secondsLeft = Math.max(
    1,
    Math.ceil((SLIDE_DURATION * (1 - progress / 100)) / 1000),
  );

  return (
    <main className="app-shell">
      <section className="stage" aria-live="polite">
        {isLoading ? null : currentSlide ? (
          <article className="slide" key={currentSlide.id}>
            <div className="qr-panel">
              <div className="qr-frame">
                {/* User-supplied QR images need their original pixels preserved. */}
                <img
                  src={currentSlide.image}
                  alt={`QR code for ${currentSlide.title}`}
                />
              </div>
            </div>

            <div className="copy-panel">
              <h1>{currentSlide.title}</h1>
              <p className="description">{currentSlide.description}</p>
            </div>
          </article>
        ) : (
          <div className="empty-state">
            <div className="empty-qr" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="eyebrow">Your slideshow starts here</p>
            <h1>Add your first QR slide</h1>
            <p>
              Choose a QR image, add a title and description, and it will rotate
              automatically every fifteen seconds.
            </p>
          </div>
        )}
      </section>

      {slides.length > 0 && !isFormOpen && (
        <button
          className="presentation-trigger"
          type="button"
          onClick={() => setIsFormOpen(true)}
          aria-label="Open slide manager"
        />
      )}

      <footer className="timer" aria-label={`${secondsLeft} seconds remaining`}>
        <div
          className={`timer-fill ${isFormOpen ? "paused" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </footer>

      {isFormOpen && (
        <div className="form-backdrop" role="presentation">
          <aside
            className="slide-form-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
          >
            <div className="form-heading">
              <div>
                <p className="eyebrow">
                  {editingId ? "Edit slide" : "New slide"}
                </p>
                <h2 id="form-title">
                  {editingId ? "Update slide" : "Add a QR code"}
                </h2>
              </div>
              {slides.length > 0 && (
                <button
                  className="close-button"
                  type="button"
                  onClick={closeManager}
                  aria-label="Close form"
                >
                  ×
                </button>
              )}
            </div>

            <form onSubmit={saveSlide}>
              {saveError && (
                <p className="save-error" role="alert">
                  {saveError}
                </p>
              )}
              <label className="upload-field">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImage}
                  required={!editingId}
                />
                {image ? (
                  <img src={image} alt="Selected QR code preview" />
                ) : (
                  <span className="upload-placeholder">
                    <span className="upload-icon" aria-hidden="true">
                      ↑
                    </span>
                    <strong>Choose QR image</strong>
                    <small>PNG, JPG or WebP</small>
                  </span>
                )}
              </label>
              {fileName && <p className="file-name">{fileName}</p>}

              <label className="text-field">
                <span>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Open the event guide"
                  maxLength={70}
                  required
                />
              </label>

              <label className="text-field">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Write a short explanation for this QR code…"
                  maxLength={320}
                  rows={5}
                  required
                />
                <small>{description.length} / 320</small>
              </label>

              <button
                className="submit-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Add to slideshow"}
                <span aria-hidden="true">→</span>
              </button>
              {editingId && (
                <button
                  className="cancel-edit-button"
                  type="button"
                  onClick={resetEditor}
                >
                  Cancel editing
                </button>
              )}
            </form>

            {slides.length > 0 && (
              <section className="slide-manager" aria-labelledby="slides-title">
                <div className="manager-heading">
                  <h3 id="slides-title">Slides</h3>
                  <span>{slides.length}</span>
                </div>
                <div className="manager-list">
                  {slides.map((slide, index) => (
                    <div className="manager-slide" key={slide.id}>
                      <img src={slide.image} alt="" />
                      <div className="manager-slide-info">
                        <strong>{slide.title}</strong>
                        <small>Slide {index + 1}</small>
                      </div>
                      <div className="manager-actions">
                        <button
                          className="edit-action"
                          type="button"
                          onClick={() => beginEdit(slide)}
                          aria-label={`Edit ${slide.title}`}
                        >
                          Edit
                        </button>
                        <button
                          className="remove-action"
                          type="button"
                          onClick={() => void deleteSlide(slide.id)}
                          aria-label={`Remove ${slide.title}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
