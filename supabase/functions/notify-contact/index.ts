// Supabase Edge Function — emails the owner whenever a new kaya_feedback /
// contact message is inserted. The owner's address lives only in this
// function's secrets (NOTIFY_EMAIL), never in the app bundle.
//
// Secrets required (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY  — from resend.com
//   NOTIFY_EMAIL    — your personal email (where notifications go)
//   HOOK_SECRET     — any random string; also set as a webhook header (optional but recommended)

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL")!;
const HOOK_SECRET = Deno.env.get("HOOK_SECRET");

Deno.serve(async (req) => {
  // Optional shared-secret check (set header x-hook-secret on the webhook).
  if (HOOK_SECRET && req.headers.get("x-hook-secret") !== HOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Supabase DB webhooks send { type, table, record, old_record }.
  const row = payload.record ?? payload;
  const message: string = row?.message ?? "(no message)";

  // The contact form tags an optional reply address as "reply-to: someone@email".
  const replyTo = String(message).match(/reply-to:\s*([^\s\n]+)/i)?.[1];
  const isContact = String(message).startsWith("[Contact]");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Kaya <onboarding@resend.dev>",
      to: [NOTIFY_EMAIL],
      ...(replyTo ? { reply_to: [replyTo] } : {}),
      subject: isContact ? "New Kaya contact message" : "New Kaya feedback",
      text: message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(`Resend error: ${err}`, { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
