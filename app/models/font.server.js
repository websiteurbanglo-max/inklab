import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../firebase.server";

// ── Default fonts (Google Fonts) available to every shop automatically ──────
// WOFF2 URLs are the Latin-subset files fetched directly from fonts.gstatic.com.
// To update a URL, change only the entry below — no Firestore writes required.
export const SYSTEM_FONTS = [
  // Script / Handwriting
  {
    id: "system-pacifico",
    shopDomain: "",
    name: "Pacifico",
    fileName: "Pacifico.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ-6H6Mk.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-dancing-script",
    shopDomain: "",
    name: "Dancing Script",
    fileName: "DancingScript.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup8.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-great-vibes",
    shopDomain: "",
    name: "Great Vibes",
    fileName: "GreatVibes.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/greatvibes/v21/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-satisfy",
    shopDomain: "",
    name: "Satisfy",
    fileName: "Satisfy.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/satisfy/v22/rP2Hp2yn6lkG50LoCZOIHQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-caveat",
    shopDomain: "",
    name: "Caveat",
    fileName: "Caveat.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpYQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-permanent-marker",
    shopDomain: "",
    name: "Permanent Marker",
    fileName: "PermanentMarker.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004La2Cfw.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  // Display / Decorative
  {
    id: "system-lobster",
    shopDomain: "",
    name: "Lobster",
    fileName: "Lobster.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/lobster/v32/neILzCirqoswsqX9zoKmMw.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-abril-fatface",
    shopDomain: "",
    name: "Abril Fatface",
    fileName: "AbrilFatface.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/abrilfatface/v25/zOL64pLDlL1D99S8g8PtiKchq-dmjQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-bebas-neue",
    shopDomain: "",
    name: "Bebas Neue",
    fileName: "BebasNeue.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-anton",
    shopDomain: "",
    name: "Anton",
    fileName: "Anton.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3Kz-C8.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-fredoka-one",
    shopDomain: "",
    name: "Fredoka One",
    fileName: "FredokaOne.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/fredokaone/v15/k3kUo8kEI-tA1RRcTZGmTlHGCac.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-righteous",
    shopDomain: "",
    name: "Righteous",
    fileName: "Righteous.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/righteous/v18/1cXxaUPXBpj2rGoU7C9WiHGF.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  // Classic Serif
  {
    id: "system-playfair-display",
    shopDomain: "",
    name: "Playfair Display",
    fileName: "PlayfairDisplay.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-cinzel",
    shopDomain: "",
    name: "Cinzel",
    fileName: "Cinzel.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnfY3lDQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  // Modern Sans-Serif
  {
    id: "system-montserrat",
    shopDomain: "",
    name: "Montserrat",
    fileName: "Montserrat.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-raleway",
    shopDomain: "",
    name: "Raleway",
    fileName: "Raleway.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/raleway/v37/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaorCIPrE.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-lato",
    shopDomain: "",
    name: "Lato",
    fileName: "Lato.woff2",
    storageUrl: "https://fonts.gstatic.com/s/lato/v25/S6uyw4BMUTPHjx4wXg.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-oswald",
    shopDomain: "",
    name: "Oswald",
    fileName: "Oswald.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiZQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-exo-2",
    shopDomain: "",
    name: "Exo 2",
    fileName: "Exo2.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/exo2/v26/7cH1v4okm5zmbvwkAx_sfcEuiD8jvvKsOdC_.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-oswald-bold",
    shopDomain: "",
    name: "Oswald Bold",
    fileName: "OswaldBold.woff2",
    storageUrl:
      "https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs89FvsUZiZQ.woff2",
    isActive: true,
    isSystem: true,
    createdAt: null,
  },
];
const fontsCollection = (shopDomain) =>
  getDb().collection("fonts").doc(shopDomain).collection("items");

export async function getFonts(shopDomain) {
  console.log(`[font] getFonts (active only) shopDomain=${shopDomain}`);
  const snapshot = await fontsCollection(shopDomain)
    .where("isActive", "==", true)
    .orderBy("createdAt", "desc")
    .get();
  const shopFonts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log(
    `[font] getFonts returned ${shopFonts.length} shop fonts + ${SYSTEM_FONTS.length} system fonts`,
  );

  // System fonts appear first so customers always have options even before the merchant uploads anything
  return [...SYSTEM_FONTS, ...shopFonts];
}

export async function getAllFonts(shopDomain) {
  console.log(`[font] getAllFonts shopDomain=${shopDomain}`);
  const snapshot = await fontsCollection(shopDomain)
    .orderBy("createdAt", "desc")
    .get();
  const shopFonts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log(
    `[font] getAllFonts returned ${shopFonts.length} shop fonts + ${SYSTEM_FONTS.length} system fonts`,
  );

  return [...SYSTEM_FONTS, ...shopFonts];
}

export async function createFont(shopDomain, data) {
  const id = uuidv4();

  console.log(
    `[font] createFont shopDomain=${shopDomain} name="${data.name}" id=${id}`,
  );
  const fontData = {
    shopDomain,
    name: data.name,
    fileName: data.fileName,
    storageUrl: data.storageUrl,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  await fontsCollection(shopDomain).doc(id).set(fontData);
  console.log(`[font] createFont OK id=${id}`);

  return { id, ...fontData };
}

export async function toggleFont(shopDomain, fontId, isActive) {
  console.log(
    `[font] toggleFont shopDomain=${shopDomain} fontId=${fontId} isActive=${isActive}`,
  );
  await fontsCollection(shopDomain).doc(fontId).update({ isActive });
  console.log(`[font] toggleFont OK`);
}

export async function deleteFont(shopDomain, fontId) {
  console.log(`[font] deleteFont shopDomain=${shopDomain} fontId=${fontId}`);
  await fontsCollection(shopDomain).doc(fontId).delete();
  console.log(`[font] deleteFont OK`);
}
