const ALLOWED_ORIGIN = "https://github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function getCryptoKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function hashEmail(email, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.toLowerCase().trim()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function encryptEmail(email, secret) {
  const key = await getCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(email.toLowerCase().trim())
  );
  return {
    encrypted_email: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decryptEmail(encryptedB64, ivB64, secret) {
  const key = await getCryptoKey(secret);
  const encrypted = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/unsubscribe") {
      const hash = url.searchParams.get("token");
      if (hash) {
        await env.DB.prepare("DELETE FROM reminders WHERE email_hash = ?").bind(hash).run();
      }
      return new Response("You have been unsubscribed and your encrypted email was deleted.", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (request.method === "POST" && url.pathname === "/schedule") {
      try {
        const { id, email, title, course, dueTimestamp } = await request.json();
        if (!email || !email.includes("@") || !title || !dueTimestamp) {
          return new Response(JSON.stringify({ error: "Missing fields" }), {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          });
        }

        const email_hash = await hashEmail(email, env.ENCRYPTION_KEY);
        const { encrypted_email, iv } = await encryptEmail(email, env.ENCRYPTION_KEY);

        await env.DB.prepare(
          `INSERT INTO reminders (id, email_hash, encrypted_email, iv, title, course, due_timestamp, sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT(id) DO UPDATE SET
             email_hash = excluded.email_hash,
             encrypted_email = excluded.encrypted_email,
             iv = excluded.iv,
             title = excluded.title,
             course = excluded.course,
             due_timestamp = excluded.due_timestamp,
             sent = 0`
        )
          .bind(id || crypto.randomUUID(), email_hash, encrypted_email, iv, title, course || "", Number(dueTimestamp))
          .run();

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },

  async scheduled(event, env) {
    const now = Date.now();
    const { results } = await env.DB.prepare(
      "SELECT * FROM reminders WHERE sent = 0 AND due_timestamp <= ?"
    )
      .bind(now)
      .all();

    if (!results || results.length === 0) return;

    const grouped = new Map();
    for (const row of results) {
      if (!grouped.has(row.email_hash)) grouped.set(row.email_hash, []);
      grouped.get(row.email_hash).push(row);
    }

    for (const [emailHash, items] of grouped.entries()) {
      const toEmail = await decryptEmail(items.encrypted_email, items.iv, env.ENCRYPTION_KEY);
      const unsubUrl = `https://workers.dev{emailHash}`;

      const listHtml = items
        .map((i) => `<li><strong>${i.title}</strong>${i.course ? ` (${i.course})` : ""}</li>`)
        .join("");

      await fetch("https://resend.com", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Study Planner <onboarding@resend.dev>",
          to: [toEmail],
          subject:
            items.length === 1
              ? `Reminder: ${items.title}`
              : `Reminder: ${items.length} Study Planner items due now`,
          html: `<p>Hey! Here are your Study Planner reminders:</p><ul>${listHtml}</ul><p style="font-size:12px;color:#666"><a href="${unsubUrl}">Unsubscribe & delete my encrypted email</a></p>`,
        }),
      });

      for (const item of items) {
        await env.DB.prepare("UPDATE reminders SET sent = 1 WHERE id = ?").bind(item.id).run();
      }
    }
  },
};
