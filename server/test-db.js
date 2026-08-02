require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connected!");
    console.log(result.rows[0]);
  } catch (err) {
    console.error("❌ Connection failed");
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();