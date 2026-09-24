import { createHash, timingSafeEqual } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function matchesPasscode(passcode: string | null, expectedHash: unknown): boolean {
  if (typeof expectedHash !== "string") return true;
  if (!passcode) return false;
  const actual = Buffer.from(createHash("sha256").update(passcode).digest("hex"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export default async function publicDeck(request: Request) {
  try {
    const url = new URL(request.url);
    const deckId = url.searchParams.get("deckId")?.trim();
    if (!deckId || request.method !== "GET") return json({ error: "Deck not found." }, 404);
    const db = getFirestore(getFirebaseAdminApp());
    const matches = await db.collectionGroup("decks").where("__name__", "==", deckId).limit(1).get();
    const deck = matches.docs[0];
    if (!deck || deck.get("status") !== "active" || deck.get("publicationStatus") !== "published") return json({ error: "Presentation not found." }, 404);
    if (!matchesPasscode(url.searchParams.get("passcode"), deck.get("presentationPasscodeHash"))) return json({ error: "This presentation needs its passcode.", passcodeRequired: true }, 401);
    const workspace = deck.ref.parent.parent;
    if (!workspace) return json({ error: "Presentation not found." }, 404);
    const slides = await deck.ref.collection("slides").orderBy("position").get();
    const activeSlides = slides.docs.filter((slide) => slide.get("status") === "active");
    const codes = await Promise.all(activeSlides.map(async (slide) => {
      const qrCodeId = slide.get("qrCodeId");
      if (typeof qrCodeId !== "string") return null;
      const qrCode = await workspace.collection("qrCodes").doc(qrCodeId).get();
      if (!qrCode.exists || qrCode.get("status") !== "active") return null;
      const iconId = qrCode.get("iconId");
      const icon = typeof iconId === "string" ? await workspace.collection("icons").doc(iconId).get() : null;
      return { content: qrCode.get("content"), color: qrCode.get("color"), version: qrCode.get("version"), iconImage: icon?.exists && icon.get("status") === "active" ? icon.get("imageDataUrl") : null };
    }));
    return json({ deck: { id: deck.id, name: deck.get("name"), defaultDisplayDurationSeconds: deck.get("defaultDisplayDurationSeconds") }, slides: activeSlides.map((slide, index) => {
      const code = codes[index];
      return { id: slide.id, title: slide.get("title"), description: slide.get("description"), displayDurationSeconds: slide.get("displayDurationSeconds") ?? null, qrCode: code && typeof code.content === "string" && typeof code.color === "string" && Number.isSafeInteger(code.version) ? code : null };
    }) });
  } catch (error) { console.error("Public deck request failed.", error); return json({ error: "Presentation unavailable." }, 503); }
}
