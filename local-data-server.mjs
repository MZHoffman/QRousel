import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const slidesFile = path.join(projectRoot, "slides.json");
const picturesDirectory = path.join(projectRoot, "pictures");
const host = "127.0.0.1";
const port = 3001;
const maxRequestBytes = 12 * 1024 * 1024;

const imageTypes = {
  "image/png": { extension: "png", contentType: "image/png" },
  "image/jpeg": { extension: "jpg", contentType: "image/jpeg" },
  "image/webp": { extension: "webp", contentType: "image/webp" },
  "image/gif": { extension: "gif", contentType: "image/gif" },
};

await fs.mkdir(picturesDirectory, { recursive: true });

async function readSlides() {
  try {
    const content = await fs.readFile(slidesFile, "utf8");
    const slides = JSON.parse(content);
    return Array.isArray(slides) ? slides : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      await writeSlides([]);
      return [];
    }
    throw error;
  }
}

async function writeSlides(slides) {
  const temporaryFile = `${slidesFile}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(slides, null, 2)}\n`, "utf8");
  await fs.rename(temporaryFile, slidesFile);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function publicSlide(slide) {
  return {
    ...slide,
    image: `http://${host}:${port}/pictures/${encodeURIComponent(slide.imageFile)}`,
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) {
      throw new Error("The selected image is too large.");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function servePicture(response, requestedName) {
  const fileName = path.basename(decodeURIComponent(requestedName));
  const extension = path.extname(fileName).slice(1).toLowerCase();
  const contentType =
    Object.values(imageTypes).find((type) => type.extension === extension)
      ?.contentType ?? "application/octet-stream";

  try {
    const picture = await fs.readFile(path.join(picturesDirectory, fileName));
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
      "Content-Type": contentType,
      "Content-Length": picture.length,
    });
    response.end(picture);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendJson(response, 404, { error: "Picture not found." });
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (request.method === "GET" && url.pathname === "/slides") {
      const slides = await readSlides();
      sendJson(response, 200, slides.map(publicSlide));
      return;
    }

    if (request.method === "POST" && url.pathname === "/slides") {
      const input = await readJsonBody(request);
      const title = String(input.title ?? "").trim().slice(0, 70);
      const description = String(input.description ?? "").trim().slice(0, 320);
      const originalFileName = path.basename(String(input.fileName ?? "qr-code"));
      const imageMatch = String(input.image ?? "").match(
        /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/,
      );

      if (!title || !description || !imageMatch) {
        sendJson(response, 400, { error: "A QR image, title and description are required." });
        return;
      }

      const imageType = imageTypes[imageMatch[1]];
      const id = randomUUID();
      const imageFile = `${id}.${imageType.extension}`;
      const picturePath = path.join(picturesDirectory, imageFile);
      const imageBuffer = Buffer.from(imageMatch[2], "base64");

      if (imageBuffer.length === 0 || imageBuffer.length > 8 * 1024 * 1024) {
        sendJson(response, 400, { error: "The selected image must be smaller than 8 MB." });
        return;
      }

      const slide = {
        id,
        title,
        description,
        fileName: originalFileName,
        imageFile,
      };

      await fs.writeFile(picturePath, imageBuffer);
      try {
        const slides = await readSlides();
        slides.push(slide);
        await writeSlides(slides);
      } catch (error) {
        await fs.unlink(picturePath).catch(() => {});
        throw error;
      }

      sendJson(response, 201, publicSlide(slide));
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/slides/")) {
      const id = decodeURIComponent(url.pathname.slice("/slides/".length));
      const input = await readJsonBody(request);
      const title = String(input.title ?? "").trim().slice(0, 70);
      const description = String(input.description ?? "").trim().slice(0, 320);
      const slides = await readSlides();
      const slideIndex = slides.findIndex((item) => item.id === id);

      if (slideIndex === -1) {
        sendJson(response, 404, { error: "Slide not found." });
        return;
      }

      if (!title || !description) {
        sendJson(response, 400, { error: "A title and description are required." });
        return;
      }

      const previousSlide = slides[slideIndex];
      const updatedSlide = {
        ...previousSlide,
        title,
        description,
      };
      let replacementPath;

      if (input.image) {
        const imageMatch = String(input.image).match(
          /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/,
        );
        if (!imageMatch) {
          sendJson(response, 400, { error: "The replacement image is invalid." });
          return;
        }

        const imageType = imageTypes[imageMatch[1]];
        const imageBuffer = Buffer.from(imageMatch[2], "base64");
        if (imageBuffer.length === 0 || imageBuffer.length > 8 * 1024 * 1024) {
          sendJson(response, 400, { error: "The selected image must be smaller than 8 MB." });
          return;
        }

        updatedSlide.imageFile = `${id}-${randomUUID()}.${imageType.extension}`;
        updatedSlide.fileName = path.basename(
          String(input.fileName ?? previousSlide.fileName),
        );
        replacementPath = path.join(picturesDirectory, updatedSlide.imageFile);
        await fs.writeFile(replacementPath, imageBuffer);
      }

      slides[slideIndex] = updatedSlide;
      try {
        await writeSlides(slides);
      } catch (error) {
        if (replacementPath) await fs.unlink(replacementPath).catch(() => {});
        throw error;
      }

      if (replacementPath && previousSlide.imageFile !== updatedSlide.imageFile) {
        await fs
          .unlink(
            path.join(
              picturesDirectory,
              path.basename(previousSlide.imageFile),
            ),
          )
          .catch((error) => {
            if (error?.code !== "ENOENT") throw error;
          });
      }

      sendJson(response, 200, publicSlide(updatedSlide));
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/slides/")) {
      const id = decodeURIComponent(url.pathname.slice("/slides/".length));
      const slides = await readSlides();
      const slide = slides.find((item) => item.id === id);

      if (!slide) {
        sendJson(response, 404, { error: "Slide not found." });
        return;
      }

      await writeSlides(slides.filter((item) => item.id !== id));
      await fs
        .unlink(path.join(picturesDirectory, path.basename(slide.imageFile)))
        .catch((error) => {
          if (error?.code !== "ENOENT") throw error;
        });

      sendJson(response, 200, { deleted: true });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/pictures/")) {
      await servePicture(response, url.pathname.slice("/pictures/".length));
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Unable to save slides.";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Local slide storage: http://${host}:${port}`);
  process.send?.({ type: "ready" });
});
