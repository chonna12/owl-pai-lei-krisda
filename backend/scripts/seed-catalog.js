import pg from 'pg';
import { readFile } from 'node:fs/promises';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  // Add catalog stock to an existing database without replacing order history.
  const sql = await readFile(new URL('../database/catalog-expansion.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Catalog labels cleaned and stock added.');
} catch (error) {
  console.error('Catalog update stopped:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
