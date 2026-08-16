/**
 * Fractional / lexicographic ordering keys (used for navigation sibling order).
 *
 * Keys are strings over a 64-character alphabet; ordering is plain
 * lexicographic (byte order), which is exactly what PostgreSQL uses for TEXT
 * ORDER BY. Convention: a key is non-empty and never ends with the smallest
 * alphabet character (`0`), so the ordering is dense — there is always room
 * to insert a key between two existing ones without rewriting siblings.
 *
 * `between(a, b)` returns a key strictly between two existing keys.
 * When keys grow too long after many insertions between the same pair,
 * callers should `rebalance` the sibling list instead.
 */

/**
 * 64 chars in strict ASCII/byte order — string comparison in JS (and
 * PostgreSQL TEXT ORDER BY) uses byte order, so the alphabet MUST be sorted.
 * This is the base64url alphabet (minus + and /) in byte order.
 */
export const ALPHABET = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
export const MIN_CHAR = ALPHABET[0]; // "-"
export const MAX_CHAR = ALPHABET[ALPHABET.length - 1]; // "z"
export const BASE = ALPHABET.length; // 64

const charIndex = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i++) charIndex.set(ALPHABET[i], i);

/** Keys longer than this trigger a sibling rebalance. */
export const MAX_KEY_LENGTH = 24;

export function isValidKey(key: string): boolean {
  if (key.length === 0) return false;
  return [...key].every((c) => charIndex.has(c)) && key[key.length - 1] !== MIN_CHAR;
}

/** Longest common prefix length. */
function lcp(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function leadingMinCount(s: string): number {
  let i = 0;
  while (i < s.length && s[i] === MIN_CHAR) i++;
  return i;
}

/**
 * A key greater than "" and strictly less than `r`.
 * Requires r non-empty and not ending with MIN_CHAR.
 *
 * - r starts with a non-min char: "-" + "1" is always smaller than r
 *   (because '-' < r[0]).
 * - r starts with the min char: prepend the min char and recurse, so the
 *   result shares r's min-char prefix but diverges below it.
 */
function midSuffix(r: string): string {
  if (r[0] === MIN_CHAR) {
    return MIN_CHAR + midSuffix(r.slice(1));
  }
  return MIN_CHAR + "1";
}

/**
 * Returns a key strictly between `a` and `b`.
 * - a === null means "no lower bound" (-∞)
 * - b === null means "no upper bound" (+∞)
 * - when both are non-null, requires a < b (lexicographic)
 */
export function between(a: string | null, b: string | null): string {
  if (a === null && b === null) {
    // First key in a list: middle of the alphabet, keeps room on both sides.
    return ALPHABET[Math.floor(BASE / 2)];
  }
  if (b === null) {
    // Need x > a: append "01" (a is a prefix of the result).
    if (a === null) return ALPHABET[Math.floor(BASE / 2)];
    return a + "01";
  }
  if (a === null) {
    // Need x < b.
    return midSuffix(b);
  }
  if (a >= b) {
    throw new Error(`between(): expected a < b, got "${a}" >= "${b}"`);
  }

  const i = lcp(a, b);
  if (i === a.length) {
    // a is a proper prefix of b: x = a + s with "" < s < b[i..].
    return a + midSuffix(b.slice(i));
  }

  // First differing character: a[i] < b[i].
  const ai = charIndex.get(a[i])!;
  const bi = charIndex.get(b[i])!;
  const mid = Math.floor((ai + bi) / 2);
  if (mid > ai && mid < bi) {
    // Room for a single char strictly between at position i.
    return a.slice(0, i) + ALPHABET[mid];
  }
  // Adjacent at position i (bi === ai + 1): x must share a's char at i and
  // extend past a. Appending "1" keeps x < b because a[i] < b[i] decides.
  return a + "1";
}

/** Key greater than `a` (append to end of a list). */
export function after(a: string | null): string {
  return between(a, null);
}

/** Key smaller than `b` (prepend to start of a list). */
export function before(b: string | null): string {
  return between(null, b);
}

function encodeBase64(value: bigint, digits: number): string {
  const out: string[] = [];
  let v = value;
  for (let i = digits - 1; i >= 0; i--) {
    const pow = BigInt(BASE) ** BigInt(i);
    const d = v / pow;
    out.push(ALPHABET[Number(d)]);
    v -= d * pow;
  }
  return out.join("");
}

/**
 * Produces `n` evenly-spaced, short, strictly increasing keys for a sibling
 * list. Rewrites every sibling, so call only when a key has grown too long.
 */
export function rebalanceKeys(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [ALPHABET[Math.floor(BASE / 2)]];
  const digits = Math.max(2, Math.ceil(Math.log(n + 1) / Math.log(BASE)) + 1);
  const maxVal = BigInt(BASE) ** BigInt(digits) - 1n;
  const keys: string[] = [];
  const nn = BigInt(n - 1);
  for (let k = 0; k < n; k++) {
    // v in [1, maxVal], strictly increasing.
    const v = 1n + (BigInt(k) * (maxVal - 1n)) / nn;
    // Strip trailing min chars so keys never end with MIN_CHAR.
    keys.push(encodeBase64(v, digits).replace(new RegExp(MIN_CHAR + "+$"), ""));
  }
  return keys;
}

/** Asserts a list of keys is strictly increasing and valid. Throws otherwise. */
export function assertSorted(keys: string[]): void {
  for (let i = 0; i < keys.length; i++) {
    if (!isValidKey(keys[i])) {
      throw new Error(`invalid key at ${i}: "${keys[i]}"`);
    }
    if (i > 0 && keys[i - 1] >= keys[i]) {
      throw new Error(`keys out of order at ${i}: "${keys[i - 1]}" >= "${keys[i]}"`);
    }
  }
}
