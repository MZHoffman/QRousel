import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const redirectable = (value: unknown): value is string => typeof value === "string" && (/^https?:\/\//i.test(value) || /^mailto:/i.test(value) || /^tel:/i.test(value));

export default async function scanRedirect(request: Request) {
  try {
    const codeId = new URL(request.url).searchParams.get("qrCodeId")?.trim();
    if (!codeId || request.method !== "GET") return json({ error: "QR code not found." }, 404);
    const db = getFirestore(getFirebaseAdminApp());
    const matches = await db.collectionGroup("qrCodes").where("__name__", "==", codeId).limit(1).get();
    const code = matches.docs[0];
    if (!code || code.get("status") !== "active" || !redirectable(code.get("content"))) return json({ error: "QR code not found." }, 404);
    await db.runTransaction(async (transaction) => { const current = await transaction.get(code.ref); const timestamps = Array.isArray(current.get("scanTimestamps")) ? current.get("scanTimestamps").filter((value: unknown) => Number.isSafeInteger(value)).slice(-999) : []; transaction.update(code.ref, { scanTimestamps: [...timestamps, Date.now()], scanCount: (Number.isSafeInteger(current.get("scanCount")) ? current.get("scanCount") : timestamps.length) + 1, lastScannedAt: FieldValue.serverTimestamp() }); });
    return new Response(null, { status: 302, headers: { location: code.get("content"), "cache-control": "no-store" } });
  } catch (error) { console.error("QR scan redirect failed.", error); return json({ error: "QR code is unavailable." }, 503); }
}
