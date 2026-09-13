const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function base64ToBytes(value: string) {
  const s = atob(value);
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function keyFromSecret(secret: string) {
  if (!secret) throw new Error("AI_CREDENTIALS_ENCRYPTION_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
  const key = await keyFromSecret(Deno.env.get("AI_CREDENTIALS_ENCRYPTION_KEY") || "");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(value: string) {
  const [iv64, cipher64] = String(value || "").split(".");
  if (!iv64 || !cipher64) throw new Error("Invalid encrypted credential");
  const key = await keyFromSecret(Deno.env.get("AI_CREDENTIALS_ENCRYPTION_KEY") || "");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv64) }, key, base64ToBytes(cipher64));
  return decoder.decode(plain);
}
