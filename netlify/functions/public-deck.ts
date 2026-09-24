import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export default async function publicDeck(request: Request) {
  try {
    const deckId = new URL(request.url).searchParams.get("deckId")?.trim();
    if (!deckId || request.method !== "GET") return json({ error: "Deck not found." }, 404);
    const db = getFirestore(getFirebaseAdminApp());
    const matches = await db.collectionGroup("decks").where("__name__", "==", deckId).limit(1).get();
    const deck = matches.docs[0];
    if (!deck || deck.get("status") !== "active" || deck.get("publicationStatus") !== "published") return json({ error: "Presentation not found." }, 404);
    const slides = await deck.ref.collection("slides").orderBy("position").get();
    return json({ deck: { id: deck.id, name: deck.get("name"), defaultDisplayDurationSeconds: deck.get("defaultDisplayDurationSeconds") }, slides: slides.docs.filter((slide) => slide.get("status") === "active").map((slide) => ({ id: slide.id, title: slide.get("title"), description: slide.get("description"), qrCodeId: slide.get("qrCodeId") ?? null, displayDurationSeconds: slide.get("displayDurationSeconds") ?? null })) });
  } catch (error) { console.error("Public deck request failed.", error); return json({ error: "Presentation unavailable." }, 503); }
}
