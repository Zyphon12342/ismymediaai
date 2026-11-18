import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Correction policy",
  description: "How rights holders, creators and anyone else can ask isMyMediaAI to review a verdict, a claim or a title's details.",
  alternates: { canonical: "/corrections" },
};

export default function CorrectionPolicyPage() {
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-6 text-zinc-800">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Correction policy</h1>
      <p>
        isMyMediaAI shows what its members think about whether a film, show or book used generative AI. We want that to be
        fair to the people who made it. If something here is wrong, use the <strong>Request a correction</strong> link at the
        bottom of the title&apos;s page. You do not need an account.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">What we can correct</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Wrong details:</strong> the title, year, credits, cover or description. We fix these once we can check them.
          </li>
          <li>
            <strong>False or unsupported claims in comments:</strong> comments that state something as fact without evidence,
            or that are shown to be wrong, can be hidden or removed.
          </li>
          <li>
            <strong>Vote manipulation:</strong> if a title&apos;s votes look coordinated or come from throwaway accounts, we
            mark the verdict as under review and remove votes that break the rules.
          </li>
          <li>
            <strong>Duplicates:</strong> two pages for the same title are merged into one.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">What we do not change</h2>
        <p>
          The verdict is the result of genuine votes by members, and we never add, remove or edit genuine votes on request,
          including from a rights holder. A verdict only appears once at least five members have voted. If the community has
          it wrong, the best answer is evidence: an official statement or credits page in your request, or a comment with an
          evidence link, which members can read before they vote.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">What happens after you send a request</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Your request goes to our moderators&apos; queue. Only moderators can see it.</li>
          <li>A moderator checks it against the evidence you gave and the title&apos;s votes and comments.</li>
          <li>They make any change that fits this policy and reply to the email address you gave, saying what they did and why.</li>
        </ol>
        <p>Every change a moderator makes is recorded in an internal log.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">Your details</h2>
        <p>
          We use your name and email address only to handle and reply to your request. We delete them a year after the
          request is closed. See the{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>{" "}
          for more.
        </p>
      </section>
    </article>
  );
}
