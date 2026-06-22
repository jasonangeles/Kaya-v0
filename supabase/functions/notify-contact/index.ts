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
// Sender — must be on a domain verified in Resend. Override via the FROM_EMAIL secret.
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Kaya <no-reply@kayawealth.app>";

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

  // Two row shapes: feedback/contact (has `message`) or a new signup (has `email`, no message).
  let subject: string;
  let text: string;
  let replyTo: string | undefined;

  if (row?.message) {
    const message = String(row.message);
    replyTo = message.match(/reply-to:\s*([^\s\n]+)/i)?.[1];
    subject = message.startsWith("[Contact]") ? "New Kaya contact message" : "New Kaya feedback";
    text = message;
  } else if (row?.email) {
    subject = "New Kaya signup";
    text = `A new user just signed up:\n${row.email}`;
  } else {
    return new Response("Nothing to notify", { status: 200 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [NOTIFY_EMAIL],
      ...(replyTo ? { reply_to: [replyTo] } : {}),
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(`Resend error: ${err}`, { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
