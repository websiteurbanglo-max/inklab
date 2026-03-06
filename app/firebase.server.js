import admin from "firebase-admin";

function getFirebaseApp() {
  if (global._firebaseApp) return global._firebaseApp;
  // ── Startup diagnostics ────────────────────────────────────────────────
  console.log("[firebase] Initialising Firebase Admin SDK");
  console.log(
    "[firebase] FIREBASE_PROJECT_ID present:",
    !!process.env.FIREBASE_PROJECT_ID,
  );
  console.log(
    "[firebase] FIREBASE_CLIENT_EMAIL present:",
    !!process.env.FIREBASE_CLIENT_EMAIL,
  );
  console.log(
    "[firebase] FIREBASE_PRIVATE_KEY present:",
    !!process.env.FIREBASE_PRIVATE_KEY,
  );
  console.log(
    "[firebase] FIREBASE_STORAGE_BUCKET present:",
    !!process.env.FIREBASE_STORAGE_BUCKET,
  );
  // ─────────────────────────────────────────────────────────────────────
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !privateKey
  ) {
    const missing = [
      !process.env.FIREBASE_PROJECT_ID && "FIREBASE_PROJECT_ID",
      !process.env.FIREBASE_CLIENT_EMAIL && "FIREBASE_CLIENT_EMAIL",
      !privateKey && "FIREBASE_PRIVATE_KEY",
    ]
      .filter(Boolean)
      .join(", ");

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
    console.log(
      "[firebase] Admin SDK initialised OK — project:",
      process.env.FIREBASE_PROJECT_ID,
    );
  } catch (err) {
    console.error("[firebase] admin.initializeApp() FAILED:", err);
    throw err;
  }

  return global._firebaseApp;
}

export function getDb() {
  return getFirebaseApp().firestore();
}

export function getStorage() {
  return getFirebaseApp().storage();
}

/**
 * Upload a Buffer to Firebase Storage and return a permanent public download URL.
 * @param buffer  File content
 * @param destination  Storage path, e.g. "uploads/shop.myshopify.com/raw/abc.png"
 * @param contentType  MIME type
 */
export async function uploadToStorage(buffer, destination, contentType) {
  const bucket = getStorage().bucket();
  const file = bucket.file(destination);

  await file.save(buffer, {
    metadata: { contentType },
    // Make the file publicly readable
    predefinedAcl: "publicRead",
  });

  // Return the public URL
  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
}
