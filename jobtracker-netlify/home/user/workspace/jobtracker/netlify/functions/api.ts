import express from "express";
import serverless from "serverless-http";
import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_2TfuMvgm3nUz@ep-damp-butterfly-ag7nc8vu-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

// Auto-create table on cold start
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      location TEXT,
      contract_type TEXT,
      salary TEXT,
      offer_url TEXT,
      contact_name TEXT,
      contact_email TEXT,
      status TEXT NOT NULL DEFAULT 'En attente',
      applied_date TEXT NOT NULL,
      notes TEXT,
      created_at BIGINT NOT NULL
    )
  `);
  tableReady = true;
}

function rowToApp(row: any) {
  return {
    id: Number(row.id),
    company: row.company,
    position: row.position,
    location: row.location ?? null,
    contractType: row.contract_type ?? null,
    salary: row.salary ?? null,
    offerUrl: row.offer_url ?? null,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    status: row.status,
    appliedDate: row.applied_date,
    notes: row.notes ?? null,
    createdAt: Number(row.created_at),
  };
}

const app = express();
app.use(express.json());

// Middleware: ensure table exists
app.use(async (_req, _res, next) => {
  try {
    await ensureTable();
    next();
  } catch (e) {
    next(e);
  }
});

// GET all
app.get("/api/applications", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM applications ORDER BY created_at DESC"
    );
    res.json(rows.map(rowToApp));
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

// GET single
app.get("/api/applications/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM applications WHERE id = $1",
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToApp(rows[0]));
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

// POST create
app.post("/api/applications", async (req, res) => {
  try {
    const b = req.body;
    if (!b.company || !b.position || !b.appliedDate) {
      return res.status(400).json({ error: "company, position et appliedDate sont requis" });
    }
    const { rows } = await pool.query(
      `INSERT INTO applications
         (company, position, location, contract_type, salary, offer_url,
          contact_name, contact_email, status, applied_date, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        b.company, b.position,
        b.location ?? null, b.contractType ?? null, b.salary ?? null,
        b.offerUrl ?? null, b.contactName ?? null, b.contactEmail ?? null,
        b.status ?? "En attente", b.appliedDate, b.notes ?? null,
        Date.now(),
      ]
    );
    res.status(201).json(rowToApp(rows[0]));
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

// PATCH update
app.patch("/api/applications/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fieldMap: Record<string, string> = {
      company: "company", position: "position", location: "location",
      contractType: "contract_type", salary: "salary", offerUrl: "offer_url",
      contactName: "contact_name", contactEmail: "contact_email",
      status: "status", appliedDate: "applied_date", notes: "notes",
    };
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in req.body) {
        setClauses.push(`${col} = $${idx++}`);
        values.push(req.body[key] ?? null);
      }
    }
    if (!setClauses.length) {
      const { rows } = await pool.query("SELECT * FROM applications WHERE id = $1", [id]);
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      return res.json(rowToApp(rows[0]));
    }
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE applications SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rowToApp(rows[0]));
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE
app.delete("/api/applications/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM applications WHERE id = $1", [Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

// Export CSV
app.get("/api/applications/export/csv", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM applications ORDER BY created_at DESC");
    const apps = rows.map(rowToApp);
    const headers = ["Entreprise","Poste","Localisation","Type de contrat","Salaire","URL offre","Contact","Email contact","Statut","Date candidature","Notes"];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escape).join(","),
      ...apps.map(a => [
        a.company, a.position, a.location ?? "", a.contractType ?? "",
        a.salary ?? "", a.offerUrl ?? "", a.contactName ?? "",
        a.contactEmail ?? "", a.status, a.appliedDate,
        (a.notes ?? "").replace(/\n/g, " "),
      ].map(escape).join(","))
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="candidatures.csv"');
    res.send("\uFEFF" + csv);
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

export const handler = serverless(app);
