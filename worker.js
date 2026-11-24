const ALLOWED_ORIGIN = "https://claudeman55692000.github.io";
const WORKER_URL = "https://planner.gabe55692000.workers.dev";
const TIME_ZONE = "America/Chicago";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

async function getCryptoKey(secret) {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function hashEmail(email, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(email.toLowerCase().trim())
  );
  return [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
    encrypted_email: btoa(
      String.fromCharCode(...new Uint8Array(encrypted))
    ),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decryptEmail(encryptedB64, ivB64, secret) {
  const key = await getCryptoKey(secret);
  const encrypted = Uint8Array.from(atob(encryptedB64), (char) =>
    char.charCodeAt(0)
  );
  const iv = Uint8Array.from(atob(ivB64), (char) => char.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

async function ensureDigestTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS digest_sends (
      email_hash TEXT NOT NULL,
      local_date TEXT NOT NULL,
      period TEXT NOT NULL,
      PRIMARY KEY (email_hash, local_date, period)
    )
  `).run();
}

function chicagoParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function chicagoDate(date) {
  const parts = chicagoParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nextDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

function chicagoMidnightUtc(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;

  // Convert local midnight in Chicago to its corresponding UTC timestamp.
  for (let i = 0; i < 3; i++) {
    const parts = chicagoParts(new Date(guess));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    guess += target - represented;
  }

  return guess;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

async function sendDigest(env, email, emailHash, date, period, items) {
  const unsubscribeUrl =
    `${WORKER_URL}/unsubscribe?token=${encodeURIComponent(emailHash)}`;

  const itemLines = items.map((item) => {
    const due = new Date(Number(item.due_timestamp)).toLocaleString("en-US", {
      timeZone: TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const course = item.course ? ` (${item.course})` : "";
    return `• ${item.title}${course} — due ${due}`;
  });

  const morning = period === "am";
  const subject = morning
    ? `Today's study planner reminders (${items.length})`
    : `Tonight and tomorrow's study planner reminders (${items.length})`;

  const text = [
    `Your ${morning ? "6 AM" : "6 PM"} study planner digest for ${date}:`,
    "",
    ...itemLines,
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const htmlItems = items.map((item) => {
    const due = new Date(Number(item.due_timestamp)).toLocaleString("en-US", {
      timeZone: TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const course = item.course ? ` (${escapeHtml(item.course)})` : "";
    return `<li><strong>${escapeHtml(item.title)}</strong>${course} — due ${escapeHtml(due)}</li>`;
  }).join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Study Planner <onboarding@resend.dev>",
      to: [email],
      subject,
      text,
      html: `<p>Your ${morning ? "6 AM" : "6 PM"} study planner digest:</p><ul>${htmlItems}</ul><p><a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

async function handleSchedule(request, env) {
  try {
    const { id, email, title, course, dueTimestamp } = await request.json();

    if (!id || !email || !email.includes("@") || !title) {
      return jsonResponse({ error: "Missing or invalid fields" }, 400);
    }

    const timestamp =
      dueTimestamp === null || dueTimestamp === undefined
        ? null
        : Number(dueTimestamp);

    if (timestamp !== null && !Number.isFinite(timestamp)) {
      return jsonResponse({ error: "Invalid dueTimestamp" }, 400);
    }

    const email_hash = await hashEmail(email, env.ENCRYPTION_KEY);
    const { encrypted_email, iv } = await encryptEmail(
      email,
      env.ENCRYPTION_KEY
    );

    await env.DB.prepare(`
      INSERT INTO reminders
        (id, email_hash, encrypted_email, iv, title, course, due_timestamp, sent)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        email_hash = excluded.email_hash,
        encrypted_email = excluded.encrypted_email,
        iv = excluded.iv,
        title = excluded.title,
        course = excluded.course,
        due_timestamp = excluded.due_timestamp,
        sent = 0
    `).bind(
      String(id),
      email_hash,
      encrypted_email,
      iv,
      String(title),
      course || "",
      timestamp
    ).run();

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Schedule error:", error);
    return jsonResponse({ error: "Could not schedule reminder" }, 500);
  }
}

async function handleDelete(request, env) {
  try {
    const { id } = await request.json();
    if (!id) return jsonResponse({ error: "Missing id" }, 400);

    await env.DB.prepare("DELETE FROM reminders WHERE id = ?")
      .bind(String(id))
      .run();

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete error:", error);
    return jsonResponse({ error: "Could not delete reminder" }, 500);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/unsubscribe") {
      const hash = url.searchParams.get("token") || "";
      if (!/^[0-9a-f]{64}$/i.test(hash)) {
        return new Response("Invalid unsubscribe link.", {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "text/plain" },
        });
      }

      try {
        await ensureDigestTable(env);
        await env.DB.prepare("DELETE FROM reminders WHERE email_hash = ?")
          .bind(hash)
          .run();
        await env.DB.prepare("DELETE FROM digest_sends WHERE email_hash = ?")
          .bind(hash)
          .run();

        return new Response(
          "You have been unsubscribed and your encrypted email was deleted.",
          { headers: { ...corsHeaders(), "Content-Type": "text/plain" } }
        );
      } catch (error) {
        console.error("Unsubscribe error:", error);
        return new Response("Could not unsubscribe right now.", {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "text/plain" },
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/schedule") {
      return handleSchedule(request, env);
    }

    if (request.method === "POST" && url.pathname === "/delete") {
      return handleDelete(request, env);
    }

    return new Response("Not found", {
      status: 404,
      headers: corsHeaders(),
    });
  },

  async scheduled(event, env) {
    await ensureDigestTable(env);

    const now = new Date();
    const parts = chicagoParts(now);
    const hour = Number(parts.hour);

    // The */10 * * * * cron sends once during each Chicago 6 o'clock hour.
    if (hour !== 6 && hour !== 18) return;

    const date = chicagoDate(now);
    const tomorrow = nextDate(date);
    const dayAfterTomorrow = nextDate(tomorrow);
    const start = chicagoMidnightUtc(date);
    const endToday = chicagoMidnightUtc(tomorrow);
    const endTomorrow = chicagoMidnightUtc(dayAfterTomorrow);
    const period = hour === 6 ? "am" : "pm";

    const query = period === "am"
      ? `SELECT id, email_hash, encrypted_email, iv, title, course, due_timestamp
         FROM reminders
         WHERE sent = 0 AND due_timestamp >= ? AND due_timestamp < ?
         ORDER BY email_hash, due_timestamp`
      : `SELECT id, email_hash, encrypted_email, iv, title, course, due_timestamp
         FROM reminders
         WHERE due_timestamp >= ? AND due_timestamp < ?
         ORDER BY email_hash, due_timestamp`;

    const { results = [] } = await env.DB.prepare(query)
      .bind(start, period === "am" ? endToday : endTomorrow)
      .all();

    const grouped = new Map();
    for (const row of results) {
      if (!grouped.has(row.email_hash)) grouped.set(row.email_hash, []);
      grouped.get(row.email_hash).push(row);
    }

    for (const [emailHash, items] of grouped.entries()) {
      try {
        const alreadySent = await env.DB.prepare(`
          SELECT 1 FROM digest_sends
          WHERE email_hash = ? AND local_date = ? AND period = ?
        `).bind(emailHash, date, period).first();

        if (alreadySent) continue;

        // All rows for a hash use the same normalized email and encryption key.
        const firstItem = items[0];
        const toEmail = await decryptEmail(
          firstItem.encrypted_email,
          firstItem.iv,
          env.ENCRYPTION_KEY
        );

        await sendDigest(env, toEmail, emailHash, date, period, items);

        await env.DB.prepare(`
          INSERT OR IGNORE INTO digest_sends (email_hash, local_date, period)
          VALUES (?, ?, ?)
        `).bind(emailHash, date, period).run();

        // "sent" means included in the morning digest. The evening query
        // intentionally includes these rows again if they remain incomplete.
        if (period === "am") {
          for (const item of items) {
            await env.DB.prepare("UPDATE reminders SET sent = 1 WHERE id = ?")
              .bind(item.id)
              .run();
          }
        }
      } catch (error) {
        console.error(`Digest failed for ${emailHash}:`, error);
      }
    }
  },
};
