const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ENV_KEY =
  "AI_CREDENTIALS_ENCRYPTION_KEY";

let cachedKey: CryptoKey | null = null;
let cachedSecret = "";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (!value) {
    throw new Error("Invalid encrypted credential");
  }

  try {
    const binary = atob(value);

    return Uint8Array.from(
      binary,
      (char) => char.charCodeAt(0)
    );
  } catch {
    throw new Error(
      "Invalid encrypted credential"
    );
  }
}

async function keyFromSecret(
  secret: string
): Promise<CryptoKey> {
  const normalized = String(secret || "").trim();

  if (!normalized) {
    throw new Error(
      `${ENV_KEY} is not configured`
    );
  }

  /*
   * Keep the existing SHA-256 → AES-GCM derivation
   * so credentials already encrypted by the current
   * application remain decryptable.
   */
  if (
    cachedKey &&
    cachedSecret === normalized
  ) {
    return cachedKey;
  }

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(normalized)
    );

  cachedKey =
    await crypto.subtle.importKey(
      "raw",
      digest,
      {
        name: "AES-GCM"
      },
      false,
      [
        "encrypt",
        "decrypt"
      ]
    );

  cachedSecret = normalized;

  return cachedKey;
}

export async function encryptSecret(
  value: string
): Promise<string> {
  const plaintext = String(value ?? "");

  if (!plaintext) {
    throw new Error(
      "Cannot encrypt an empty credential"
    );
  }

  const secret =
    Deno.env.get(ENV_KEY) || "";

  const key =
    await keyFromSecret(secret);

  /*
   * 96-bit random IV is the standard nonce size
   * for AES-GCM.
   *
   * Never reuse an IV with the same key.
   */
  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );

  const ciphertext =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encoder.encode(plaintext)
    );

  return [
    bytesToBase64(iv),
    bytesToBase64(
      new Uint8Array(ciphertext)
    )
  ].join(".");
}

export async function decryptSecret(
  value: string
): Promise<string> {
  const encoded =
    String(value || "").trim();

  const parts =
    encoded.split(".");

  if (parts.length !== 2) {
    throw new Error(
      "Invalid encrypted credential"
    );
  }

  const [
    iv64,
    cipher64
  ] = parts;

  if (!iv64 || !cipher64) {
    throw new Error(
      "Invalid encrypted credential"
    );
  }

  const secret =
    Deno.env.get(ENV_KEY) || "";

  const key =
    await keyFromSecret(secret);

  try {
    const plaintext =
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64ToBytes(iv64)
        },
        key,
        base64ToBytes(cipher64)
      );

    return decoder.decode(
      plaintext
    );
  } catch {
    /*
     * Do not expose whether the key, IV,
     * ciphertext, or authentication tag
     * was incorrect.
     */
    throw new Error(
      "Unable to decrypt credential"
    );
  }
}
