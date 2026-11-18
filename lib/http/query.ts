/**
 * Read only the named query parameters, as plain strings. Unknown keys are
 * ignored and repeated keys keep the first value, so the result never
 * carries attacker-chosen property names.
 */
export function pickParams<K extends string>(params: URLSearchParams, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v !== null) out[k] = v;
  }
  return out;
}
