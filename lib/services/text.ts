/** Remove trailing characters that are in `chars`, without a backtracking regex. */
export function trimEnd(s: string, chars: string): string {
  let end = s.length;
  while (end > 0 && chars.includes(s[end - 1]!)) end--;
  return s.slice(0, end);
}

/** Remove leading characters that are in `chars`. */
export function trimStart(s: string, chars: string): string {
  let start = 0;
  while (start < s.length && chars.includes(s[start]!)) start++;
  return s.slice(start);
}
