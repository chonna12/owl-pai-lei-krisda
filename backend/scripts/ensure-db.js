// Render builds initialize a new database once. Existing data is preserved.
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
let exists;
try {
  const result = await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='owl') AS exists");
  exists = result.rows[0].exists;
} finally {
  await pool.end();
}
if (exists) console.log('Existing Owl database preserved.');
else await import('./setup-db.js');
