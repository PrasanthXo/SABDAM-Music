import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.SQL_HOST || "127.0.0.1",
  user: process.env.SQL_USER || "postgres",
  password: process.env.SQL_PASSWORD || "",
  database: process.env.SQL_DB_NAME || "postgres",
  connectionTimeoutMillis: 5000
});

try {
  const result = await pool.query(`
    SELECT id, user_uid, title, created_at, updated_at
    FROM user_playlists
    WHERE LOWER(title) LIKE '%morning%'
       OR LOWER(title) LIKE '%favourite%'
       OR LOWER(title) LIKE '%favorite%'
    ORDER BY updated_at DESC
  `);

  console.table(result.rows);
  console.log("Matches:", result.rowCount);
} catch (e) {
  console.error("DATABASE ERROR:", e.message);
} finally {
  await pool.end();
}
