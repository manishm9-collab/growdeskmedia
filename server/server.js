/**
 * Growdeskmedia - Lead capture backend
 * ------------------------------------
 * Receives quote-form submissions from index.html (POST /api/lead),
 * saves every lead to leads.json, and emails a notification to
 * growdeskmedia@gmail.com.
 *
 * Run locally:
 *   1. npm install
 *   2. copy .env.example to .env and fill in your Gmail App Password
 *   3. npm start
 *   4. open http://localhost:3000
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const LEADS_FILE = path.join(__dirname, "leads.json");
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "growdeskmedia@gmail.com";

app.use(express.json());
const allowedOrigins = [
  "https://growdeskmedia.com",
  "https://www.growdeskmedia.com"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.static(path.join(__dirname, ".."))); // serves index.html from project root

// --- Rate limiting (very basic, in-memory) ---
const recentSubmissions = new Map(); // ip -> timestamp[]
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxPerWindow = 5;
  const hits = (recentSubmissions.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  recentSubmissions.set(ip, hits);
  return hits.length > maxPerWindow;
}

// --- Helpers ---
function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveLead(lead) {
  const leads = readLeads();
  leads.push(lead);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

function isValidPhone(phone) {
  return /^[+0-9 ()-]{7,20}$/.test(phone);
}

// --- Mailer (optional - only sends if SMTP creds are set in .env) ---
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function notifyByEmail(lead) {
  if (!transporter) return; // email not configured, silently skip
  const serviceList = (lead.services || []).join(", ") || "Not specified";
  await transporter.sendMail({
    from: `"Growdeskmedia Website" <${process.env.SMTP_USER}>`,
    to: NOTIFY_EMAIL,
    replyTo: lead.email || undefined,
    subject: `New lead: ${lead.name} (${lead.city})`,
    text:
      `New quote request from the website\n\n` +
      `Name: ${lead.name}\n` +
      `Business type: ${lead.businessType}\n` +
      `City: ${lead.city}\n` +
      `Phone: ${lead.phone}\n` +
      `Email: ${lead.email || "-"}\n` +
      `Instagram: ${lead.instagram || "-"}\n` +
      `Facebook: ${lead.facebook || "-"}\n` +
      `Website: ${lead.website || "-"}\n` +
      `WhatsApp: ${lead.whatsapp || "-"}\n` +
      `Competitors: ${lead.competitors || "-"}\n` +
      `Services interested in: ${serviceList}\n` +
      `Message: ${lead.message || "-"}\n` +
      `Submitted at: ${lead.submittedAt}\n`
  });
}

const pgConfig = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
};
let pgPool = null;
if (pgConfig.host && pgConfig.user && pgConfig.password && pgConfig.database) {
  pgPool = new Pool({
    host: pgConfig.host,
    port: pgConfig.port,
    user: pgConfig.user,
    password: pgConfig.password,
    database: pgConfig.database,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
  });
}

async function queryDb(sql, params = []) {
  if (!pgPool) {
    throw new Error("PostgreSQL is not configured. Set PGHOST, PGUSER, PGPASSWORD, and PGDATABASE in .env.");
  }
  return pgPool.query(sql, params);
}

// --- Routes ---
app.post("/api/lead", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "Too many submissions. Please try again in a minute." });
  }

  const body = req.body || {};
  const name = String(body.name || "").trim();
  const businessType = String(body.businessType || "").trim();
  const city = String(body.city || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();

  if (!name || !city || !phone) {
    return res.status(400).json({ ok: false, error: "Name, city and phone are required." });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid phone number." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    businessType,
    city,
    phone,
    email,
    instagram: String(body.instagram || "").trim(),
    facebook: String(body.facebook || "").trim(),
    website: String(body.website || "").trim(),
    whatsapp: String(body.whatsapp || "").trim(),
    competitors: String(body.competitors || "").trim(),
    services: Array.isArray(body.services) ? body.services : [],
    message: String(body.message || "").trim(),
    submittedAt: new Date().toISOString(),
    ip
  };

  try {
  await queryDb(
    `INSERT INTO leads
    (
      name,
      business_type,
      city,
      phone,
      email,
      instagram,
      facebook,
      website,
      whatsapp,
      competitors,
      services,
      message,
      submitted_at,
      ip
    )
    VALUES
    (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )`,
    [
      lead.name,
      lead.businessType,
      lead.city,
      lead.phone,
      lead.email,
      lead.instagram,
      lead.facebook,
      lead.website,
      lead.whatsapp,
      lead.competitors,
      lead.services,
      lead.message,
      lead.submittedAt,
      lead.ip
    ]
  );

  console.log("✅ Lead saved to PostgreSQL");

} catch (err) {
  console.error("Database Error:", err);

  return res.status(500).json({
    ok: false,
    error: "Failed to save lead."
  });
}

  // Fire-and-forget email notification, do not block the response on it
  notifyByEmail(lead).catch((err) => console.error("Email notification failed:", err));

  return res.status(200).json({ ok: true });
});

// Protected customer management endpoints
app.post("/api/customers", async (req, res) => {
  const key = req.query.key;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (!pgPool) {
    return res.status(500).json({ ok: false, error: "PostgreSQL is not configured. Set PGHOST, PGUSER, PGPASSWORD, and PGDATABASE in .env." });
  }

  const allowedFields = ["name", "email", "phone", "company", "address", "city", "state", "country", "website", "notes"];
  const payload = req.body || {};
  const columns = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] != null && String(payload[field]).trim() !== "") {
      columns.push(field);
      values.push(String(payload[field]).trim());
    }
  }

  if (columns.length === 0) {
    return res.status(400).json({ ok: false, error: "Provide at least one valid customer field in the request body." });
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const insertSql = `INSERT INTO customers (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;

  try {
    const result = await queryDb(insertSql, values);
    return res.status(201).json({ ok: true, customer: result.rows[0] });
  } catch (err) {
    console.error("Failed to save customer:", err);
    return res.status(500).json({ ok: false, error: "Could not save customer details to PostgreSQL." });
  }
});

app.get("/api/customers", async (req, res) => {
  const key = req.query.key;

  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  if (!pgPool) {
    return res.status(500).json({
      ok: false,
      error: "PostgreSQL is not configured."
    });
  }

  try {
    const result = await queryDb(
      "SELECT * FROM customers ORDER BY id DESC"
    );

    return res.json({
      ok: true,
      customers: result.rows
    });

  } catch (err) {
    console.error("Failed to fetch customers:", err);

    return res.status(500).json({
      ok: false,
      error: "Could not load customers."
    });
  }
});

app.get("/api/leads", async (req, res) => {
  const key = req.query.key;

  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  try {
    const result = await queryDb(
      "SELECT * FROM leads ORDER BY submitted_at DESC"
    );

    return res.json({
      ok: true,
      leads: result.rows
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      ok: false,
      error: "Database error"
    });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Growdeskmedia server running at http://localhost:${PORT}`);
});
