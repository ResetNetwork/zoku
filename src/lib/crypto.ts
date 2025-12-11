// Credential encryption/decryption using AES-GCM

export async function encryptCredentials(
  plaintext: string,
  key: string
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'AES-GCM',
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(plaintext)
  );

  // Return iv + ciphertext as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

export async function decryptCredentials(
  encrypted: string,
  key: string
): Promise<string> {
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    'AES-GCM',
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return decoder.decode(plaintext);
}
