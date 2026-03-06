import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

declare global {
  // eslint-disable-next-line no-var
  var _firebaseApp: admin.app.App | undefined;
}

function getFirebaseApp(): admin.app.App {
  if (global._firebaseApp) return global._firebaseApp;

  // ── Startup diagnostics ────────────────────────────────────────────────
  console.log("[firebase] Initialising Firebase Admin SDK");
  console.log("[firebase] FIREBASE_PROJECT_ID present:", !!process.env.FIREBASE_PROJECT_ID);
  console.log("[firebase] FIREBASE_CLIENT_EMAIL present:", !!process.env.FIREBASE_CLIENT_EMAIL);
  console.log("[firebase] FIREBASE_PRIVATE_KEY present:", !!process.env.FIREBASE_PRIVATE_KEY);
  console.log("[firebase] FIREBASE_STORAGE_BUCKET present:", !!process.env.FIREBASE_STORAGE_BUCKET);
  // ─────────────────────────────────────────────────────────────────────

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    const missing = [
      !process.env.FIREBASE_PROJECT_ID && "FIREBASE_PROJECT_ID",
      !process.env.FIREBASE_CLIENT_EMAIL && "FIREBASE_CLIENT_EMAIL",
      !privateKey && "FIREBASE_PRIVATE_KEY",
    ].filter(Boolean).join(", ");
    console.error("[firebase] FATAL — missing env vars:", missing);
    throw new Error(`Missing Firebase environment variables: ${missing}`);
  }

  try {
    global._firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log("[firebase] Admin SDK initialised OK — project:", process.env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.error("[firebase] admin.initializeApp() FAILED:", err);
    throw err;
  }

  return global._firebaseApp;
}

export function getDb(): Firestore {
  return getFirebaseApp().firestore();
}

export function getStorage(): Storage {
  return getFirebaseApp().storage();
}

/**
 * Upload a Buffer to Firebase Storage and return a permanent public download URL.
 * @param buffer  File content
 * @param destination  Storage path, e.g. "uploads/shop.myshopify.com/raw/abc.png"
 * @param contentType  MIME type
 */
export async function uploadToStorage(
  buffer: Buffer,
  destination: string,
  contentType: string
): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(destination);

  // Generate a download token — this is the same mechanism used by the Firebase Console.
  // It embeds into the URL and bypasses Firebase Security Rules, so storefront visitors
  // (unauthenticated) can load the image directly in the browser / on the canvas.
  const downloadToken = uuidv4();

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  // Firebase Storage download URL with token — works cross-origin, no auth required
  const encodedPath = encodeURIComponent(destination);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}
