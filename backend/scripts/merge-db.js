// Run once on the old 23-table database after creating a backup.
import pg from 'pg';
import {readFile} from 'node:fs/promises';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
try {
  const {rows} = await pool.query("SELECT to_regclass('owl.order_items') IS NOT NULL AS old_schema");
  if (!rows[0].old_schema) {
    console.log('No old order_items table found. Nothing changed.');
  } else {
    await pool.query(await readFile(new URL('../database/consolidate-21.sql', import.meta.url), 'utf8'));
    console.log('Merged to 21 tables. Orders and queue data were preserved.');
  }
} catch (error) {
  console.error('Merge stopped:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
