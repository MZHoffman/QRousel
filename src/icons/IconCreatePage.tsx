import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useIconLibrary } from "./use-icon-library";

function renderCrop(file: File, zoom: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas is unavailable."));
      const cropSize = Math.min(image.width, image.height) / zoom;
      context.drawImage(image, (image.width - cropSize) / 2, (image.height - cropSize) / 2, cropSize, cropSize, 0, 0, 512, 512);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", 0.88));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The image could not be read.")); };
    image.src = url;
  });
}

export default function IconCreatePage({ library, role, onBack }: { library: ReturnType<typeof useIconLibrary>; role: WorkspaceRole; onBack: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState("");
  const [processing, setProcessing] = useState(false);
  const previewLabel = useMemo(() => file ? `${file.name}, cropped square` : "No image selected", [file]);
  async function refreshCrop(nextFile: File, nextZoom: number) { setProcessing(true); try { setPreview(await renderCrop(nextFile, nextZoom)); } catch { setPreview(""); } finally { setProcessing(false); } }
  async function choose(event: ChangeEvent<HTMLInputElement>) { const selected = event.target.files?.[0]; if (selected) { setFile(selected); setZoom(1); await refreshCrop(selected, 1); } }
  function updateZoom(nextZoom: number) { setZoom(nextZoom); if (file) void refreshCrop(file, nextZoom); }
  async function submit(event: FormEvent) { event.preventDefault(); if (preview && await library.create(name, preview)) onBack(); }
  return <><button className="deck-editor-back" type="button" onClick={onBack}><span>←</span> Icons</button><header className="deck-editor-heading"><div><span className="deck-status">new reusable icon</span><h1>Add an icon</h1><p>Upload an image, then save its square crop for every QR code in this workspace.</p></div></header><form className="deck-settings-card deck-create-page" onSubmit={submit}><label><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Event logo" /></label><label><span>Image</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={choose} /></label>{file && <label><span>Crop zoom: {zoom.toFixed(1)}×</span><input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} /></label>}{preview && <figure className="icon-editor-preview"><img src={preview} alt={previewLabel} /><figcaption>{previewLabel}</figcaption></figure>}{library.error && <p className="auth-error">{library.error}</p>}<div className="deck-settings-actions"><button type="button" onClick={onBack}>Cancel</button><button disabled={role === "viewer" || !name.trim() || !preview || processing}>{processing ? "Preparing…" : "Save icon"}</button></div></form></>;
}
