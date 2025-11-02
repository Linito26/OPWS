// backend/src/utils/tempPassword.ts
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // sin l
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";  // sin I/O
const DIGIT = "23456789";                  // sin 0/1
const SYM   = "!@#$%^&*()-_=+[]{}";

function pick(s: string, n = 1) {
  return Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
}

export function generateTempPassword(len = 12) {
  if (len < 8) len = 8;
  // garantizar política
  const req = pick(LOWER) + pick(UPPER) + pick(DIGIT) + pick(SYM);
  const pool = LOWER + UPPER + DIGIT + SYM;
  const rest = Array.from({ length: len - 4 }, () => pool[Math.floor(Math.random() * pool.length)]).join("");
  // mezclar
  const chars = (req + rest).split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
