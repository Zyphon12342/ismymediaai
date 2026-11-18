import { linkify } from "@/lib/services/comments";

/**
 * A comment as plain text. Links are detected and marked nofollow ugc;
 * nothing is ever rendered as HTML or Markdown.
 */
export function CommentBody({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">
      {linkify(text).map((part, i) =>
        part.type === "link" ? (
          <a key={i} href={part.href} rel="nofollow ugc noopener noreferrer" target="_blank" className="underline">
            {part.value}
          </a>
        ) : (
          part.value
        ),
      )}
    </p>
  );
}
