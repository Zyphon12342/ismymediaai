import { serializeJsonLd } from "@/lib/services/seo";

/**
 * Structured data for search engines. The content is our own JSON, escaped
 * by serializeJsonLd so no text (including member names) can close the tag.
 * This is the one allowed use of raw HTML: JSON-LD must be raw script text.
 */
export function JsonLd({ data }: { data: unknown }) {
  const __html = serializeJsonLd(data);
  // eslint-disable-next-line react/no-danger -- escaped JSON-LD, see above
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html }} />; // nosemgrep
}
