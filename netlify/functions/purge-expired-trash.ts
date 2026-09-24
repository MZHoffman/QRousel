import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const RETENTION_DAYS = 90;
const RESOURCE_COLLECTIONS = [
  { collection: "decks", resourceType: "deck", nameField: "name" },
  { collection: "slides", resourceType: "slide", nameField: "title" },
  { collection: "qrCodes", resourceType: "qr-code", nameField: "name" },
  { collection: "icons", resourceType: "icon", nameField: "name" },
] as const;

export const config = { schedule: "0 3 * * *" };

export default async function purgeExpiredTrash(): Promise<Response> {
  const firestore = getFirestore(getFirebaseAdminApp());
  const cutoff = Timestamp.fromDate(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
  let deletedCount = 0;

  for (const resource of RESOURCE_COLLECTIONS) {
    const expired = await firestore
      .collectionGroup(resource.collection)
      .where("status", "==", "archived")
      .where("archivedAt", "<=", cutoff)
      .limit(400)
      .get();
    const batch = firestore.batch();
    for (const record of expired.docs) {
      const workspaceRef = record.ref.parent.parent;
      if (!workspaceRef) continue;
      const workspaceId = workspaceRef.id;
      const resourceName = record.get(resource.nameField);
      batch.delete(record.ref);
      batch.set(workspaceRef.collection("activity").doc(), {
        type: "resource.deleted",
        actorUid: "system",
        createdAt: FieldValue.serverTimestamp(),
        resourceId: record.id,
        resourceName: typeof resourceName === "string" ? resourceName : "Archived resource",
        resourceType: resource.resourceType,
        workspaceId,
        changedFields: ["automatically removed after 90 days in Trash"],
      });
      deletedCount += 1;
    }
    if (!expired.empty) await batch.commit();
  }

  return new Response(JSON.stringify({ deletedCount }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
