# Owl Pai Lei Backend and Database

The consolidated schema contains 21 tables. The API supports Buyer and Seller flows with PostgreSQL workflow functions.

## Install

1. Install Node.js 22+ and PostgreSQL 18.
2. Run npm ci in the project root.
3. Create an empty database in pgAdmin.
4. Copy backend/.env.example to backend/.env and enter your own database connection.
5. Run npm run db:setup once.
6. Run npm start. The default API address is http://127.0.0.1:3188/api/health.

## Existing databases

Back up the database before upgrading. Use the SQL files in this order in pgAdmin Query Tool with stop-on-error behavior.

- A 31-table database first runs backend/database/remove-unused-cart.sql after exporting and clearing old cart selections.
- A 30-table database runs backend/database/consolidate-23.sql.
- A 23-table database runs `npm run db:merge` with the server stopped and a backup saved first. This runs `backend/database/consolidate-21.sql` in a transaction.
- Use the matching backend code after the upgrade.

The consolidation runs inside a transaction. It preserves existing account, product, order and workflow data. It refuses databases with multiple bank accounts or verification records per seller, or custom platform fee/shipping settings. Resolve those cases before migration. Bank and verification identifiers now use the seller user_id; cancellation request identifiers now use order_id.

## Demo

Use buyer@owl.test or seller1@owl.test with password OwlDemo123!.
DEMO_PAYMENT=true enables simulated payments. No real funds are transferred.
Platform values are defined once in owl.platform_configuration(): fee 10%, shipping 50 THB, queue turn 24 hours.

See docs/ENTITIES.md for the 21 entities and docs/ER.mmd for the current relationships.

Each order buys one unit: `orders` now stores the purchased offer, seller, variant, price and item snapshots, and fulfillment status. There is no `order_items` table. QC, shipments and payout items reference `orders.order_id`.
Queue membership is stored on `seller_offers` as `queue_group_id`, `queue_position` and `skips_remaining`. There is no `queue_entries` table. Leaving a queue clears those columns and preserves the offer/history.

## Catalog and stock

New setup also applies `backend/database/catalog-expansion.sql`: a 200-product
development catalog with clothing sizes, shoe sizes, first-hand stock and separate
second-hand pieces. These records are sample inventory, not proof of a real QC inspection.
Existing orders and payment records are preserved. Public item labels omit the old Demo suffix.
For an existing database, run `npm run db:catalog` after configuring `backend/.env`.
Seed account passwords and the simulated payment endpoints remain unchanged.
