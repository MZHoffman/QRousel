"use client";

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

const SLIDE_DURATION = 5000;

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const startedAt = useRef(Date.now());

  const resetTimer = useCallback(() => {
    startedAt.current = Date.now();
    setProgress(0);
  }, []);

  const showSlide = useCallback(
    (index: number) => {
      if (!slides.length) return;
      setCurrentIndex((index + slides.length) % slides.length);
      resetTimer();
    },
    [slides.length, resetTimer],
  );

  useEffect(() => {
    if (!isPlaying || slides.length === 0 || isFormOpen) return;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const nextProgress = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(nextProgress);

      if (elapsed >= SLIDE_DURATION) {
        setCurrentIndex((index) => (index + 1) % slides.length);
        startedAt.current = Date.now();
        setProgress(0);
      }
    }, 40);

    return () => window.clearInterval(timer);
  }, [isPlaying, slides.length, isFormOpen]);

  useEffect(() => {
    resetTimer();
  }, [slides.length, resetTimer]);

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function addSlide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image || !title.trim() || !description.trim()) return;

    setSlides((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        image,
        fileName,
      },
    ]);
    setCurrentIndex(slides.length);
    setTitle("");
    setDescription("");
    setImage("");
    setFileName("");
    setIsFormOpen(false);
    setIsPlaying(true);
    resetTimer();
  }

  function deleteCurrentSlide() {
    const current = slides[currentIndex];
    if (!current) return;
    const remaining = slides.filter((slide) => slide.id !== current.id);
    setSlides(remaining);
    setCurrentIndex((index) => Math.min(index, Math.max(remaining.length - 1, 0)));
    setIsFormOpen(remaining.length === 0);
    resetTimer();
  }

  const currentSlide = slides[currentIndex];
  const secondsLeft = Math.max(
    1,
    Math.ceil((SLIDE_DURATION * (1 - progress / 100)) / 1000),
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => {
            if (slides.length) showSlide(0);
          }}
          aria-label="Go to first slide"
        >
          <span className="brand-mark" aria-hidden="true">
            Q
          </span>
          <span>QR Slides</span>
        </button>

        <div className="header-actions">
          {slides.length > 0 && (
            <span className="slide-count" aria-live="polite">
              {currentIndex + 1} / {slides.length}
            </span>
          )}
          <button
            className="add-button"
            type="button"
            onClick={() => setIsFormOpen(true)}
          >
            <span aria-hidden="true">＋</span>
            Add slide
          </button>
        </div>
      </header>

      <section className="stage" aria-live="polite">
        {currentSlide ? (
          <article className="slide" key={currentSlide.id}>
            <div className="qr-panel">
              <div className="qr-frame">
                {/* User-supplied QR images need their original pixels preserved. */}
                <img
                  src={currentSlide.image}
                  alt={`QR code for ${currentSlide.title}`}
                />
              </div>
              <p className="scan-hint">
                <span className="scan-dot" aria-hidden="true" />
                Point your camera to scan
              </p>
            </div>

            <div className="copy-panel">
              <p className="eyebrow">Scan & explore</p>
              <h1>{currentSlide.title}</h1>
              <p className="description">{currentSlide.description}</p>
              <div className="controls">
                <button
                  className="round-button"
                  type="button"
                  onClick={() => showSlide(currentIndex - 1)}
                  aria-label="Previous slide"
                >
                  ←
                </button>
                <button
                  className="play-button"
                  type="button"
                  onClick={() => {
                    setIsPlaying((playing) => !playing);
                    resetTimer();
                  }}
                  aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
                >
                  <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  className="round-button"
                  type="button"
                  onClick={() => showSlide(currentIndex + 1)}
                  aria-label="Next slide"
                >
                  →
                </button>
              </div>
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
              automatically every five seconds.
            </p>
          </div>
        )}
      </section>

      {slides.length > 0 && (
        <div className="utility-actions">
          <button type="button" onClick={deleteCurrentSlide}>
            Remove current slide
          </button>
        </div>
      )}

      <footer className="timer" aria-label={`${secondsLeft} seconds remaining`}>
        <div
          className={`timer-fill ${!isPlaying || isFormOpen ? "paused" : ""}`}
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
                <p className="eyebrow">New slide</p>
                <h2 id="form-title">Add a QR code</h2>
              </div>
              {slides.length > 0 && (
                <button
                  className="close-button"
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  aria-label="Close form"
                >
                  ×
                </button>
              )}
            </div>

            <form onSubmit={addSlide}>
              <label className="upload-field">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImage}
                  required
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

              <button className="submit-button" type="submit">
                Add to slideshow
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
