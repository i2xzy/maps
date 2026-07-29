/**
 * A Bloom filter, used to answer "does a file exist for this BSicon code?" offline.
 *
 * There are 371,890 BSicon files on Commons, 172,005 of them codes our encoder can emit.
 * Shipping the codes themselves is 2.5 MB of source and ~10–15 MB of heap; shipping the
 * bits is ~134 KB and ~134 KB. We only ever ask *membership* — never "list them" — so the
 * bits are enough.
 *
 * The trade is one-sided in exactly the direction this feature needs. A Bloom filter has
 * **no false negatives**: if it says a code is absent, it is absent. It has some false
 * positives: it may claim a dead code exists, at a rate we choose by spending bits. So the
 * worst outcome is that the icon form occasionally keeps a field whose options are broken —
 * which is the status quo — and it can never hide an icon that really exists.
 *
 * BOTH SIDES USE THIS MODULE. The generator imports it to build the filter and the browser
 * imports it to query it. That isn't tidiness: two implementations of the same hash that
 * disagree by one byte produce a filter that answers confidently and wrongly, with nothing
 * to indicate the mismatch. There is one implementation so there is nothing to drift.
 */

/** A built filter: the bits, plus the parameters needed to query them. */
export interface Bloom {
  /** Bit array, `m` bits packed little-endian into bytes. */
  bits: Uint8Array;
  /** Number of bits. */
  m: number;
  /** Number of hash probes per key. */
  k: number;
}

/**
 * FNV-1a, 32-bit, seeded.
 *
 * Chosen for being short enough to be obviously correct and stable across
 * implementations — the two properties that matter when a generator and a browser must
 * agree forever. Operates on UTF-16 code units, which is exact for BSicon codes (ASCII
 * plus the space in `STR red`).
 */
function fnv1a(key: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash ^ key.charCodeAt(i)) >>> 0;
    // hash *= 16777619, via shifts so it stays exact in 32 bits.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The `k` bit positions a key touches.
 *
 * Kirsch–Mitzenmacher: two independent hashes generate k indices as `h1 + i*h2`, which
 * performs like k independent hashes without paying for k of them. `h2 | 1` keeps the
 * step odd so it can't be a multiple of a power-of-two `m` and revisit the same bit.
 *
 * The `>>> 0` after `| 1` is not decoration. `|` yields a SIGNED int32, so a hash above
 * 2^31 became a negative step, `at` went negative, and `bit >>> 3` wrapped to an index far
 * past the end of the array — where a typed-array write is silently dropped and a read is
 * `undefined`. That produced false negatives, which a Bloom filter is supposed to make
 * impossible, for 42% of keys. Every value here must stay unsigned.
 */
function* probes(key: string, m: number, k: number): Generator<number> {
  const h1 = fnv1a(key, 0);
  const h2 = (fnv1a(key, 0x9e3779b9) | 1) >>> 0;
  let at = h1 % m;
  const step = h2 % m;
  for (let i = 0; i < k; i++) {
    yield at;
    at = (at + step) % m;
  }
}

/**
 * Filter parameters for `n` keys at a target false-positive rate.
 *
 * The standard optimum: `m = -n ln p / (ln 2)²` bits, `k = (m/n) ln 2` probes.
 */
export function bloomSize(n: number, falsePositiveRate: number): { m: number; k: number } {
  const m = Math.ceil((-n * Math.log(falsePositiveRate)) / Math.LN2 ** 2);
  return { m, k: Math.max(1, Math.round((m / n) * Math.LN2)) };
}

/** Build a filter over `keys`. */
export function bloomBuild(keys: Iterable<string>, m: number, k: number): Bloom {
  const bits = new Uint8Array(Math.ceil(m / 8));
  for (const key of keys) {
    for (const bit of probes(key, m, k)) bits[bit >>> 3]! |= 1 << (bit & 7);
  }
  return { bits, m, k };
}

/** Whether the filter may contain `key`. `false` is certain; `true` is probable. */
export function bloomHas(filter: Bloom, key: string): boolean {
  for (const bit of probes(key, filter.m, filter.k)) {
    if ((filter.bits[bit >>> 3]! & (1 << (bit & 7))) === 0) return false;
  }
  return true;
}

/** Base64 for the bits, so the filter can live in a source module. */
export function bloomToBase64(filter: Bloom): string {
  let binary = "";
  // Chunked — spreading 134 KB into `String.fromCharCode` at once overflows the stack.
  for (let i = 0; i < filter.bits.length; i += 0x8000) {
    binary += String.fromCharCode(...filter.bits.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Inverse of `bloomToBase64`. `atob` is global in both browsers and Node. */
export function bloomFromBase64(base64: string, m: number, k: number): Bloom {
  const binary = atob(base64);
  const bits = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bits[i] = binary.charCodeAt(i);
  return { bits, m, k };
}
