/** Lazy-initialize a Map entry, returning the cached or freshly computed value. */
export function getOrCompute<K, V>(
  cache: Map<K, V>,
  key: K,
  compute: () => V,
): V {
  let value = cache.get(key);
  if (value === undefined) {
    value = compute();
    cache.set(key, value);
  }
  return value;
}
