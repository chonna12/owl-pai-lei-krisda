# Owl Pai Lei Backend and Database

The consolidated schema contains 21 tables. The API supports Buyer and Seller flows with PostgreSQL workflow functions.

## Install

1. Install Node.js 22+ and PostgreSQL 18.
2. Run npm ci in the project root.
3. Create an empty database in pgAdmin.
4. Copy backend/.env.example to backend/.env and enter your own database connection.
5. Run npm run db:setup once.
6. Run npm start. The default API address is http://127.0.0.1:3188/api/health.

## Frontend build

Run `npm run build` to generate `dist/` from `frontend/`. The build checks JavaScript syntax, copies public files, and versions local asset URLs using content hashes so updates do not use stale browser files. It does not bundle or minify the source files.

`npm start` builds automatically before starting the backend. The backend serves the generated `dist/` directory. Use `npm run dev` to serve editable source files directly while developing. Generated `dist/` files are not committed; each installation builds its own copy.

On Render use Build Command `npm ci && npm run build` and Start Command `node backend/src/server.js`.

## Database files

- `backend/database/schema.sql` defines the current 21 tables, constraints, views, triggers and workflow functions.
- `backend/database/catalog-expansion.sql` supplies sample products, sizes and inventory.
- `backend/scripts/setup-db.js` installs both files once into an empty database.
- `backend/scripts/seed-catalog.js` updates the sample catalog on an existing database.
- `backend/scripts/ensure-db.js` initializes an empty database for deployment and preserves an existing schema.

Existing databases must already use the current 21-table schema. Legacy upgrade scripts are no longer included. Do not run setup again on an installed database.

## Demo

Use buyer@owl.test or seller1@owl.test with password OwlDemo123!.
DEMO_PAYMENT=true enables simulated payments. No real funds are transferred.
Platform values are defined once in owl.platform_configuration(): fee 10%, shipping 50 THB, queue turn 24 hours.

See docs/ENTITIES.md for the 21 entities and docs/ER.mmd for the current relationships.

Each order buys one unit: `orders` stores the purchased offer, seller, variant, price and item snapshots, and fulfillment status. QC, shipments and payout items reference `orders.order_id`.
Queue membership is stored on `seller_offers` as `queue_group_id`, `queue_position` and `skips_remaining`. Leaving a queue clears those columns and preserves the offer/history.

## Catalog and stock

New setup also applies `backend/database/catalog-expansion.sql`: a 200-product
development catalog with clothing sizes, shoe sizes, first-hand stock and separate
second-hand pieces. These records are sample inventory, not proof of a real QC inspection.
Existing orders and payment records are preserved. Public item labels omit the old Demo suffix.
For an existing database, run `npm run db:catalog` after configuring `backend/.env`.
Seed account passwords and the simulated payment endpoints remain unchanged.
