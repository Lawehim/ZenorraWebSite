// FR-ADM-002: minimum 12 characters, checked against a breached-password list.
// The bundled list is the most common breached passwords of 12+ characters;
// swap in a k-anonymity HIBP check when outbound network is available.
const BREACHED = new Set([
  "password1234",
  "password12345",
  "123456789012",
  "qwertyuiopas",
  "iloveyou1234",
  "administrator",
  "passwordpassword",
  "qwerty123456",
  "1q2w3e4r5t6y",
  "aaaaaaaaaaaa",
  "abcdefghijkl",
  "welcome12345",
  "zenorra12345",
  "letmein12345",
  "changeme1234",
]);

export type PolicyResult = { ok: true } | { ok: false; reason: string };

export function checkPasswordPolicy(password: string): PolicyResult {
  if (password.length < 12) return { ok: false, reason: "Use at least 12 characters." };
  if (BREACHED.has(password.toLowerCase())) {
    return { ok: false, reason: "This password appears in known data breaches. Choose another." };
  }
  return { ok: true };
}
