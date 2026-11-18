import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What isMyMediaAI collects, why, and who processes it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-6 text-zinc-800">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Privacy</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">What we store</h2>
        <p>
          Your account: email address, username, optional display name, bio and avatar, and your password in hashed form
          (or the Google or GitHub account you signed in with). What you post: votes, comments, evidence links and
          reports. Votes are private unless you choose to show them on your profile.
        </p>
        <p>
          Correction requests: the name, email address and message you send. Only moderators see them, we use them only to
          handle and reply to the request, and we delete them a year after the request is closed.
        </p>
        <p>Accounts, posts and votes are stored with Supabase. The site runs on Cloudflare.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">Analytics</h2>
        <p>
          <strong>Cloudflare Web Analytics</strong> counts page views without cookies and without identifying you.
        </p>
        <p>
          <strong>PostHog</strong> shows us how the site is used: page views, sign-ups, votes and comments, linked to your
          account by an internal id, never your email or name. With your consent it also stores a cookie and records
          sessions so we can find problems. Recordings hide all text and everything you type, and never run on sign-in,
          account or moderator pages. In the EU, EEA, UK and Switzerland, PostHog stores nothing and records nothing until
          you accept. You can change your choice any time with <em>Cookie settings</em> at the bottom of every page.
        </p>
        <p>Sign-in and sign-up are protected by Cloudflare Turnstile, which checks for bots.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">Emails</h2>
        <p>We only email you about your account (confirming your address and resetting your password), sent through Resend.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">Your choices</h2>
        <p>
          You can edit your profile, hide your votes, delete your comments and change your analytics choice at any time.
          We do not sell your data or show ads.
        </p>
      </section>
    </article>
  );
}
