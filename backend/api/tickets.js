const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Auth check
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sql = neon(process.env.DATABASE_URL);

  // GET — connection test only
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const t = req.body;
  if (!t || !t.id) {
    return res.status(400).json({ error: "Missing ticket id" });
  }

  await sql`
    INSERT INTO tickets (
      id, case_id, tin, creation_date, assign_date, handling_date,
      owner, priority, status, workgroup, issue_type, description,
      reopened, last_closed_by, escalation_reason, saved_at
    ) VALUES (
      ${t.id},
      ${t.caseId           || null},
      ${t.tin              || null},
      ${t.creationDate     || null},
      ${t.assignDate       || null},
      ${t.handlingDate     || null},
      ${t.owner            || null},
      ${t.priority         || null},
      ${t.status           || null},
      ${t.workgroup        || null},
      ${t.issueType        || null},
      ${t.description      || null},
      ${t.reopened         || null},
      ${t.lastClosedBy     || null},
      ${t.escalationReason || null},
      ${t.savedAt ? new Date(t.savedAt) : new Date()}
    )
    ON CONFLICT (id) DO UPDATE SET
      case_id           = EXCLUDED.case_id,
      status            = EXCLUDED.status,
      workgroup         = EXCLUDED.workgroup,
      owner             = EXCLUDED.owner,
      synced_at         = NOW()
  `;

  return res.status(200).json({ ok: true });
};
