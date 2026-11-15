# Database columns and constraints

Actual 21-table PostgreSQL schema. Generated from the running database.

## activity_logs

| Column | Type | Required | Keys / target |
|---|---|---|---|
| log_id | bigint | Yes | PK  |
| event_source | character varying(10) | Yes |  |
| event_type | character varying(60) | Yes |  |
| actor_id | bigint | No | FK → users.user_id |
| order_id | bigint | No | FK → orders.order_id |
| shipment_id | bigint | No | FK → shipments.shipment_id |
| group_id | bigint | No | FK → queue_groups.group_id |
| offer_id | bigint | No | FK → seller_offers.offer_id |
| refund_id | bigint | No | FK → refunds.refund_id |
| payout_id | bigint | No | FK → payouts.payout_id |
| verification_id | bigint | No | FK → users.user_id |
| charge_id | bigint | No | FK → seller_charges.charge_id |
| status | character varying(40) | No |  |
| location | character varying(150) | No |  |
| note | text | Yes |  |
| details | jsonb | Yes |  |
| entity_type | character varying(40) | No |  |
| entity_id | bigint | No |  |
| source_record_id | bigint | No |  |
| created_at | timestamp with time zone | Yes |  |

Constraints:

- `activity_logs_event_source_check`: CHECK (((event_source)::text = ANY ((ARRAY['queue'::character varying, 'shipment'::character varying, 'order'::character varying, 'audit'::character varying])::text[])))
- `activity_logs_check`: CHECK (((((event_source)::text = 'queue'::text) AND (group_id IS NOT NULL)) OR (((event_source)::text = 'shipment'::text) AND (shipment_id IS NOT NULL) AND (actor_id IS NOT NULL)) OR (((event_source)::text = 'order'::text) AND (order_id IS NOT NULL) AND (status IS NOT NULL) AND (actor_id IS NOT NULL)) OR (((event_source)::text = 'audit'::text) AND (entity_type IS NOT NULL) AND (entity_id IS NOT NULL) AND (actor_id IS NOT NULL))))
- `activity_logs_log_id_not_null`: NOT NULL log_id
- `activity_logs_event_source_not_null`: NOT NULL event_source
- `activity_logs_event_type_not_null`: NOT NULL event_type
- `activity_logs_note_not_null`: NOT NULL note
- `activity_logs_details_not_null`: NOT NULL details
- `activity_logs_created_at_not_null`: NOT NULL created_at
- `activity_logs_pkey`: PRIMARY KEY (log_id)
- `activity_logs_event_source_source_record_id_key`: UNIQUE (event_source, source_record_id)
- `activity_logs_actor_id_fkey`: FOREIGN KEY (actor_id) REFERENCES owl.users(user_id)
- `activity_logs_order_id_fkey`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)
- `activity_logs_shipment_id_fkey`: FOREIGN KEY (shipment_id) REFERENCES owl.shipments(shipment_id)
- `activity_logs_group_id_fkey`: FOREIGN KEY (group_id) REFERENCES owl.queue_groups(group_id)
- `activity_logs_offer_id_fkey`: FOREIGN KEY (offer_id) REFERENCES owl.seller_offers(offer_id)
- `activity_logs_refund_id_fkey`: FOREIGN KEY (refund_id) REFERENCES owl.refunds(refund_id)
- `activity_logs_payout_id_fkey`: FOREIGN KEY (payout_id) REFERENCES owl.payouts(payout_id)
- `activity_logs_verification_id_fkey`: FOREIGN KEY (verification_id) REFERENCES owl.users(user_id)
- `activity_logs_charge_id_fkey`: FOREIGN KEY (charge_id) REFERENCES owl.seller_charges(charge_id)

## addresses

| Column | Type | Required | Keys / target |
|---|---|---|---|
| address_id | bigint | Yes | PK  |
| user_id | bigint | Yes | FK → users.user_id |
| recipient_name | character varying(100) | Yes |  |
| phone | character varying(30) | Yes |  |
| address_line | text | Yes |  |
| district | character varying(100) | Yes |  |
| province | character varying(100) | Yes |  |
| postal_code | character varying(15) | Yes |  |
| is_default | boolean | Yes |  |
| archived | boolean | Yes |  |

Constraints:

- `addresses_recipient_name_not_null`: NOT NULL recipient_name
- `addresses_phone_not_null`: NOT NULL phone
- `addresses_address_line_not_null`: NOT NULL address_line
- `addresses_district_not_null`: NOT NULL district
- `addresses_address_id_not_null`: NOT NULL address_id
- `addresses_user_id_not_null`: NOT NULL user_id
- `addresses_province_not_null`: NOT NULL province
- `addresses_postal_code_not_null`: NOT NULL postal_code
- `addresses_is_default_not_null`: NOT NULL is_default
- `addresses_archived_not_null`: NOT NULL archived
- `addresses_pkey`: PRIMARY KEY (address_id)
- `addresses_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES owl.users(user_id)

## assets

| Column | Type | Required | Keys / target |
|---|---|---|---|
| asset_id | bigint | Yes | PK  |
| product_id | bigint | No | FK → products.product_id |
| offer_id | bigint | No | FK → seller_offers.offer_id |
| inspection_id | bigint | No | FK → qc_inspections.inspection_id |
| file_reference | text | Yes |  |
| caption | text | Yes |  |
| sort_order | smallint | Yes |  |
| source_table | character varying(30) | No |  |
| source_record_id | bigint | No |  |

Constraints:

- `assets_sort_order_check`: CHECK ((sort_order >= 0))
- `assets_check`: CHECK ((num_nonnulls(product_id, offer_id, inspection_id) = 1))
- `assets_check1`: CHECK (((source_table IS NULL) = (source_record_id IS NULL)))
- `assets_asset_id_not_null`: NOT NULL asset_id
- `assets_file_reference_not_null`: NOT NULL file_reference
- `assets_caption_not_null`: NOT NULL caption
- `assets_sort_order_not_null`: NOT NULL sort_order
- `assets_pkey`: PRIMARY KEY (asset_id)
- `assets_source_table_source_record_id_key`: UNIQUE (source_table, source_record_id)
- `assets_product_id_fkey`: FOREIGN KEY (product_id) REFERENCES owl.products(product_id)
- `assets_offer_id_fkey`: FOREIGN KEY (offer_id) REFERENCES owl.seller_offers(offer_id)
- `assets_inspection_id_fkey`: FOREIGN KEY (inspection_id) REFERENCES owl.qc_inspections(inspection_id)

## coupon_redemptions

| Column | Type | Required | Keys / target |
|---|---|---|---|
| redemption_id | bigint | Yes | PK  |
| coupon_id | bigint | Yes | FK → coupons.coupon_id |
| user_id | bigint | Yes | FK → users.user_id |
| order_id | bigint | Yes | FK → orders.order_id |
| discount_applied | numeric(12,2) | Yes |  |
| redeemed_at | timestamp with time zone | Yes |  |

Constraints:

- `coupon_redemptions_coupon_id_not_null`: NOT NULL coupon_id
- `coupon_redemptions_discount_applied_check`: CHECK ((discount_applied > (0)::numeric))
- `coupon_redemptions_redemption_id_not_null`: NOT NULL redemption_id
- `coupon_redemptions_user_id_not_null`: NOT NULL user_id
- `coupon_redemptions_order_id_not_null`: NOT NULL order_id
- `coupon_redemptions_discount_applied_not_null`: NOT NULL discount_applied
- `coupon_redemptions_redeemed_at_not_null`: NOT NULL redeemed_at
- `coupon_redemptions_pkey`: PRIMARY KEY (redemption_id)
- `coupon_redemptions_order_id_key`: UNIQUE (order_id)
- `coupon_redemptions_coupon_id_user_id_key`: UNIQUE (coupon_id, user_id)
- `coupon_redemptions_coupon_id_fkey`: FOREIGN KEY (coupon_id) REFERENCES owl.coupons(coupon_id)
- `coupon_redemptions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES owl.users(user_id)
- `coupon_redemptions_order_id_fkey`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)

## coupons

| Column | Type | Required | Keys / target |
|---|---|---|---|
| coupon_id | bigint | Yes | PK  |
| code | character varying(40) | Yes |  |
| discount_type | character varying(10) | Yes |  |
| value | numeric(12,2) | Yes |  |
| min_spend | numeric(12,2) | Yes |  |
| starts_at | timestamp with time zone | Yes |  |
| expires_at | timestamp with time zone | Yes |  |
| usage_limit | integer | Yes |  |
| active | boolean | Yes |  |
| created_by | bigint | Yes | FK → users.user_id |

Constraints:

- `coupons_discount_type_check`: CHECK (((discount_type)::text = ANY ((ARRAY['fixed'::character varying, 'percent'::character varying])::text[])))
- `coupons_value_check`: CHECK ((value > (0)::numeric))
- `coupons_min_spend_check`: CHECK ((min_spend >= (0)::numeric))
- `coupons_usage_limit_check`: CHECK ((usage_limit > 0))
- `coupons_check`: CHECK ((expires_at > starts_at))
- `coupons_check1`: CHECK ((((discount_type)::text <> 'percent'::text) OR (value <= (100)::numeric)))
- `coupons_coupon_id_not_null`: NOT NULL coupon_id
- `coupons_code_not_null`: NOT NULL code
- `coupons_discount_type_not_null`: NOT NULL discount_type
- `coupons_value_not_null`: NOT NULL value
- `coupons_min_spend_not_null`: NOT NULL min_spend
- `coupons_starts_at_not_null`: NOT NULL starts_at
- `coupons_expires_at_not_null`: NOT NULL expires_at
- `coupons_usage_limit_not_null`: NOT NULL usage_limit
- `coupons_active_not_null`: NOT NULL active
- `coupons_created_by_not_null`: NOT NULL created_by
- `coupons_pkey`: PRIMARY KEY (coupon_id)
- `coupons_code_key`: UNIQUE (code)
- `coupons_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES owl.users(user_id)

## notifications

| Column | Type | Required | Keys / target |
|---|---|---|---|
| notification_id | bigint | Yes | PK  |
| user_id | bigint | Yes | FK → users.user_id |
| order_id | bigint | No | FK → orders.order_id |
| offer_id | bigint | No | FK → seller_offers.offer_id |
| type | character varying(40) | Yes |  |
| message | text | Yes |  |
| is_read | boolean | Yes |  |
| created_at | timestamp with time zone | Yes |  |

Constraints:

- `notifications_notification_id_not_null`: NOT NULL notification_id
- `notifications_user_id_not_null`: NOT NULL user_id
- `notifications_type_not_null`: NOT NULL type
- `notifications_message_not_null`: NOT NULL message
- `notifications_is_read_not_null`: NOT NULL is_read
- `notifications_created_at_not_null`: NOT NULL created_at
- `notifications_pkey`: PRIMARY KEY (notification_id)
- `notifications_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES owl.users(user_id)
- `notifications_order_id_fkey`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)
- `notifications_offer_id_fkey`: FOREIGN KEY (offer_id) REFERENCES owl.seller_offers(offer_id)

## orders

| Column | Type | Required | Keys / target |
|---|---|---|---|
| order_id | bigint | Yes | PK  |
| buyer_id | bigint | Yes | FK → users.user_id |
| status | character varying(20) | Yes |  |
| item_subtotal | numeric(12,2) | Yes |  |
| platform_fee | numeric(12,2) | Yes |  |
| discount | numeric(12,2) | Yes |  |
| shipping_fee | numeric(12,2) | Yes |  |
| total | numeric(12,2) | Yes |  |
| coupon_id | bigint | No | FK → coupons.coupon_id |
| created_at | timestamp with time zone | Yes |  |
| cancellation_reason | text | No |  |
| cancellation_status | character varying(20) | No |  |
| cancellation_reviewed_by | bigint | No | FK → users.user_id |
| cancellation_reviewed_at | timestamp with time zone | No |  |
| cancellation_created_at | timestamp with time zone | No |  |
| completed_at | timestamp with time zone | No |  |
| shipping_recipient_name | character varying(100) | No |  |
| shipping_phone | character varying(30) | No |  |
| shipping_address_line | text | No |  |
| shipping_district | character varying(100) | No |  |
| shipping_province | character varying(100) | No |  |
| shipping_postal_code | character varying(15) | No |  |
| offer_id | bigint | Yes | FK → seller_offers.offer_id |
| seller_id | bigint | Yes | FK → users.user_id |
| variant_id | bigint | Yes | FK → product_variants.variant_id |
| product_name_snapshot | character varying(150) | Yes |  |
| size_snapshot | character varying(30) | Yes |  |
| color_snapshot | character varying(50) | Yes |  |
| condition_snapshot | character varying(10) | Yes |  |
| defects_snapshot | text | Yes |  |
| quantity | smallint | Yes |  |
| unit_price | numeric(12,2) | Yes |  |
| fulfillment_status | character varying(30) | Yes |  |

Constraints:

- `orders_status_check`: CHECK (((status)::text = ANY ((ARRAY['awaiting_payment'::character varying, 'processing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
- `orders_item_subtotal_check`: CHECK ((item_subtotal > (0)::numeric))
- `orders_platform_fee_check`: CHECK ((platform_fee >= (0)::numeric))
- `orders_discount_check`: CHECK ((discount >= (0)::numeric))
- `orders_shipping_fee_check`: CHECK ((shipping_fee >= (0)::numeric))
- `orders_total_check`: CHECK ((total >= (0)::numeric))
- `orders_cancellation_reviewed_by_fkey`: FOREIGN KEY (cancellation_reviewed_by) REFERENCES owl.users(user_id)
- `orders_cancellation_status_check`: CHECK (((cancellation_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
- `orders_check`: CHECK ((((cancellation_status IS NULL) AND (cancellation_reason IS NULL) AND (cancellation_created_at IS NULL) AND (cancellation_reviewed_by IS NULL) AND (cancellation_reviewed_at IS NULL)) OR ((cancellation_status IS NOT NULL) AND (length(TRIM(BOTH FROM cancellation_reason)) > 0) AND (cancellation_created_at IS NOT NULL) AND ((((cancellation_status)::text = 'pending'::text) AND (cancellation_reviewed_by IS NULL) AND (cancellation_reviewed_at IS NULL)) OR (((cancellation_status)::text <> 'pending'::text) AND (cancellation_reviewed_by IS NOT NULL) AND (cancellation_reviewed_at IS NOT NULL))))))
- `orders_check1`: CHECK ((discount <= (item_subtotal + platform_fee)))
- `orders_check2`: CHECK ((total = (((item_subtotal + platform_fee) - discount) + shipping_fee)))
- `orders_check3`: CHECK ((((status)::text = 'completed'::text) = (completed_at IS NOT NULL)))
- `orders_order_id_not_null`: NOT NULL order_id
- `orders_buyer_id_not_null`: NOT NULL buyer_id
- `orders_status_not_null`: NOT NULL status
- `orders_item_subtotal_not_null`: NOT NULL item_subtotal
- `orders_platform_fee_not_null`: NOT NULL platform_fee
- `orders_discount_not_null`: NOT NULL discount
- `orders_shipping_fee_not_null`: NOT NULL shipping_fee
- `orders_total_not_null`: NOT NULL total
- `orders_created_at_not_null`: NOT NULL created_at
- `orders_pkey`: PRIMARY KEY (order_id)
- `orders_buyer_id_fkey`: FOREIGN KEY (buyer_id) REFERENCES owl.users(user_id)
- `orders_coupon_id_fkey`: FOREIGN KEY (coupon_id) REFERENCES owl.coupons(coupon_id)
- `orders_offer_id_fkey`: FOREIGN KEY (offer_id) REFERENCES owl.seller_offers(offer_id)
- `orders_seller_id_fkey`: FOREIGN KEY (seller_id) REFERENCES owl.users(user_id)
- `orders_variant_id_fkey`: FOREIGN KEY (variant_id) REFERENCES owl.product_variants(variant_id)
- `orders_condition_snapshot_check`: CHECK (((condition_snapshot)::text = ANY ((ARRAY['new'::character varying, 'used'::character varying])::text[])))
- `orders_quantity_check`: CHECK ((quantity = 1))
- `orders_unit_price_check`: CHECK ((unit_price > (0)::numeric))
- `orders_fulfillment_status_check`: CHECK (((fulfillment_status)::text = ANY ((ARRAY['awaiting_payment'::character varying, 'awaiting_seller_shipment'::character varying, 'inbound'::character varying, 'awaiting_qc'::character varying, 'ready_to_ship'::character varying, 'outbound'::character varying, 'completed'::character varying, 'qc_failed'::character varying, 'return_in_transit'::character varying, 'returned'::character varying, 'cancelled'::character varying])::text[])))
- `orders_offer_id_not_null`: NOT NULL offer_id
- `orders_seller_id_not_null`: NOT NULL seller_id
- `orders_variant_id_not_null`: NOT NULL variant_id
- `orders_product_name_snapshot_not_null`: NOT NULL product_name_snapshot
- `orders_size_snapshot_not_null`: NOT NULL size_snapshot
- `orders_color_snapshot_not_null`: NOT NULL color_snapshot
- `orders_condition_snapshot_not_null`: NOT NULL condition_snapshot
- `orders_defects_snapshot_not_null`: NOT NULL defects_snapshot
- `orders_quantity_not_null`: NOT NULL quantity
- `orders_unit_price_not_null`: NOT NULL unit_price
- `orders_fulfillment_status_not_null`: NOT NULL fulfillment_status
- `address_required`: TRIGGER DEFERRABLE INITIALLY DEFERRED

## payments

| Column | Type | Required | Keys / target |
|---|---|---|---|
| payment_id | bigint | Yes | PK  |
| order_id | bigint | Yes | FK → orders.order_id |
| amount | numeric(12,2) | Yes |  |
| method | character varying(30) | Yes |  |
| status | character varying(20) | Yes |  |
| reference | character varying(120) | Yes |  |
| verified_by | bigint | No | FK → users.user_id |
| paid_at | timestamp with time zone | No |  |

Constraints:

- `payments_amount_check`: CHECK ((amount >= (0)::numeric))
- `payments_status_check`: CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'failed'::character varying, 'captured'::character varying])::text[])))
- `payments_check`: CHECK ((((status)::text = 'captured'::text) = (paid_at IS NOT NULL)))
- `payments_check1`: CHECK ((((status)::text <> 'captured'::text) OR (verified_by IS NOT NULL)))
- `payments_payment_id_not_null`: NOT NULL payment_id
- `payments_order_id_not_null`: NOT NULL order_id
- `payments_amount_not_null`: NOT NULL amount
- `payments_method_not_null`: NOT NULL method
- `payments_status_not_null`: NOT NULL status
- `payments_reference_not_null`: NOT NULL reference
- `payments_pkey`: PRIMARY KEY (payment_id)
- `payments_reference_key`: UNIQUE (reference)
- `payments_order_id_fkey`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)
- `payments_verified_by_fkey`: FOREIGN KEY (verified_by) REFERENCES owl.users(user_id)

## payout_items

| Column | Type | Required | Keys / target |
|---|---|---|---|
| payout_id | bigint | Yes | PK FK → payouts.payout_id |
| order_id | bigint | Yes | PK FK → orders.order_id |
| amount | numeric(12,2) | Yes |  |

Constraints:

- `payout_items_amount_check`: CHECK ((amount > (0)::numeric))
- `payout_items_payout_id_not_null`: NOT NULL payout_id
- `payout_items_order_item_id_not_null`: NOT NULL order_id
- `payout_items_amount_not_null`: NOT NULL amount
- `payout_items_pkey`: PRIMARY KEY (payout_id, order_id)
- `payout_items_order_item_id_key`: UNIQUE (order_id)
- `payout_items_payout_id_fkey`: FOREIGN KEY (payout_id) REFERENCES owl.payouts(payout_id)
- `payout_items_order_fk`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)

## payouts

| Column | Type | Required | Keys / target |
|---|---|---|---|
| payout_id | bigint | Yes | PK  |
| seller_id | bigint | Yes | FK → users.user_id |
| bank_account_id | bigint | Yes | FK → users.user_id |
| bank_name_snapshot | character varying(100) | Yes |  |
| account_holder_snapshot | character varying(100) | Yes |  |
| account_number_snapshot | character varying(50) | Yes |  |
| amount | numeric(12,2) | Yes |  |
| status | character varying(20) | Yes |  |
| created_by | bigint | Yes | FK → users.user_id |
| created_at | timestamp with time zone | Yes |  |
| approved_by | bigint | No | FK → users.user_id |
| approved_at | timestamp with time zone | No |  |
| paid_by | bigint | No | FK → users.user_id |
| paid_at | timestamp with time zone | No |  |
| transfer_reference | character varying(120) | No |  |

Constraints:

- `payouts_check`: CHECK ((bank_account_id = seller_id))
- `payouts_amount_check`: CHECK ((amount > (0)::numeric))
- `payouts_status_check`: CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'paid'::character varying])::text[])))
- `payouts_check1`: CHECK ((((status)::text = ANY ((ARRAY['approved'::character varying, 'paid'::character varying])::text[])) = ((approved_by IS NOT NULL) AND (approved_at IS NOT NULL))))
- `payouts_check2`: CHECK ((((status)::text = 'paid'::text) = ((paid_by IS NOT NULL) AND (paid_at IS NOT NULL) AND (transfer_reference IS NOT NULL))))
- `payouts_payout_id_not_null`: NOT NULL payout_id
- `payouts_seller_id_not_null`: NOT NULL seller_id
- `payouts_bank_account_id_not_null`: NOT NULL bank_account_id
- `payouts_bank_name_snapshot_not_null`: NOT NULL bank_name_snapshot
- `payouts_account_holder_snapshot_not_null`: NOT NULL account_holder_snapshot
- `payouts_account_number_snapshot_not_null`: NOT NULL account_number_snapshot
- `payouts_amount_not_null`: NOT NULL amount
- `payouts_status_not_null`: NOT NULL status
- `payouts_created_by_not_null`: NOT NULL created_by
- `payouts_created_at_not_null`: NOT NULL created_at
- `payouts_pkey`: PRIMARY KEY (payout_id)
- `payouts_transfer_reference_key`: UNIQUE (transfer_reference)
- `payouts_seller_id_fkey`: FOREIGN KEY (seller_id) REFERENCES owl.users(user_id)
- `payouts_bank_account_id_fkey`: FOREIGN KEY (bank_account_id) REFERENCES owl.users(user_id)
- `payouts_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES owl.users(user_id)
- `payouts_approved_by_fkey`: FOREIGN KEY (approved_by) REFERENCES owl.users(user_id)
- `payouts_paid_by_fkey`: FOREIGN KEY (paid_by) REFERENCES owl.users(user_id)

## product_variants

| Column | Type | Required | Keys / target |
|---|---|---|---|
| variant_id | bigint | Yes | PK  |
| product_id | bigint | Yes | FK → products.product_id |
| size | character varying(30) | Yes |  |
| color | character varying(50) | Yes |  |
| sku | character varying(80) | Yes |  |
| active | boolean | Yes |  |

Constraints:

- `product_variants_variant_id_not_null`: NOT NULL variant_id
- `product_variants_product_id_not_null`: NOT NULL product_id
- `product_variants_size_not_null`: NOT NULL size
- `product_variants_color_not_null`: NOT NULL color
- `product_variants_sku_not_null`: NOT NULL sku
- `product_variants_active_not_null`: NOT NULL active
- `product_variants_pkey`: PRIMARY KEY (variant_id)
- `product_variants_sku_key`: UNIQUE (sku)
- `product_variants_product_id_size_color_key`: UNIQUE (product_id, size, color)
- `product_variants_product_id_fkey`: FOREIGN KEY (product_id) REFERENCES owl.products(product_id)

## products

| Column | Type | Required | Keys / target |
|---|---|---|---|
| product_id | bigint | Yes | PK  |
| category | character varying(100) | Yes |  |
| brand_name | character varying(100) | Yes |  |
| name | character varying(150) | Yes |  |
| description | text | Yes |  |
| active | boolean | Yes |  |
| created_by | bigint | Yes | FK → users.user_id |
| created_at | timestamp with time zone | Yes |  |

Constraints:

- `products_category_check`: CHECK ((length(TRIM(BOTH FROM category)) > 0))
- `products_product_id_not_null`: NOT NULL product_id
- `products_category_not_null`: NOT NULL category
- `products_brand_name_not_null`: NOT NULL brand_name
- `products_name_not_null`: NOT NULL name
- `products_description_not_null`: NOT NULL description
- `products_active_not_null`: NOT NULL active
- `products_created_by_not_null`: NOT NULL created_by
- `products_created_at_not_null`: NOT NULL created_at
- `products_pkey`: PRIMARY KEY (product_id)
- `products_name_key`: UNIQUE (name)
- `products_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES owl.users(user_id)

## qc_inspections

| Column | Type | Required | Keys / target |
|---|---|---|---|
| inspection_id | bigint | Yes | PK  |
| order_id | bigint | Yes | FK → orders.order_id |
| inspector_id | bigint | Yes | FK → users.user_id |
| result | character varying(10) | Yes |  |
| seller_score | smallint | Yes |  |
| notes | text | Yes |  |
| inspected_at | timestamp with time zone | Yes |  |

Constraints:

- `qc_inspections_result_check`: CHECK (((result)::text = ANY ((ARRAY['pass'::character varying, 'fail'::character varying])::text[])))
- `qc_inspections_seller_score_check`: CHECK (((seller_score >= 1) AND (seller_score <= 5)))
- `qc_inspections_notes_check`: CHECK ((length(TRIM(BOTH FROM notes)) > 0))
- `qc_inspections_inspection_id_not_null`: NOT NULL inspection_id
- `qc_inspections_order_item_id_not_null`: NOT NULL order_id
- `qc_inspections_inspector_id_not_null`: NOT NULL inspector_id
- `qc_inspections_result_not_null`: NOT NULL result
- `qc_inspections_seller_score_not_null`: NOT NULL seller_score
- `qc_inspections_notes_not_null`: NOT NULL notes
- `qc_inspections_inspected_at_not_null`: NOT NULL inspected_at
- `qc_inspections_pkey`: PRIMARY KEY (inspection_id)
- `qc_inspections_order_item_id_key`: UNIQUE (order_id)
- `qc_inspections_inspector_id_fkey`: FOREIGN KEY (inspector_id) REFERENCES owl.users(user_id)
- `qc_inspections_order_fk`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)
- `final_qc_evidence`: TRIGGER DEFERRABLE INITIALLY DEFERRED

## queue_groups

| Column | Type | Required | Keys / target |
|---|---|---|---|
| group_id | bigint | Yes | PK  |
| variant_id | bigint | Yes | FK → product_variants.variant_id |
| condition | character varying(10) | Yes |  |
| active_offer_id | bigint | No | FK → seller_offers.offer_id |
| active_since | timestamp with time zone | No |  |
| next_position | bigint | Yes |  |

Constraints:

- `queue_groups_active_offer_id_fkey`: FOREIGN KEY (active_offer_id) REFERENCES owl.seller_offers(offer_id)
- `queue_groups_condition_check`: CHECK (((condition)::text = ANY ((ARRAY['new'::character varying, 'used'::character varying])::text[])))
- `queue_groups_check`: CHECK (((active_offer_id IS NULL) = (active_since IS NULL)))
- `queue_groups_group_id_not_null`: NOT NULL group_id
- `queue_groups_variant_id_not_null`: NOT NULL variant_id
- `queue_groups_condition_not_null`: NOT NULL condition
- `queue_groups_next_position_not_null`: NOT NULL next_position
- `queue_groups_pkey`: PRIMARY KEY (group_id)
- `queue_groups_variant_id_condition_key`: UNIQUE (variant_id, condition)
- `queue_groups_variant_id_fkey`: FOREIGN KEY (variant_id) REFERENCES owl.product_variants(variant_id)

## refunds

| Column | Type | Required | Keys / target |
|---|---|---|---|
| refund_id | bigint | Yes | PK  |
| order_id | bigint | Yes | FK → orders.order_id |
| payment_id | bigint | Yes | FK → payments.payment_id |
| amount | numeric(12,2) | Yes |  |
| reason | text | Yes |  |
| status | character varying(20) | Yes |  |
| approved_by | bigint | No | FK → users.user_id |
| approved_at | timestamp with time zone | No |  |
| paid_by | bigint | No | FK → users.user_id |
| paid_at | timestamp with time zone | No |  |
| transfer_reference | character varying(120) | No |  |

Constraints:

- `refunds_approved_by_fkey`: FOREIGN KEY (approved_by) REFERENCES owl.users(user_id)
- `refunds_amount_check`: CHECK ((amount >= (0)::numeric))
- `refunds_status_check`: CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'approved'::character varying, 'paid'::character varying])::text[])))
- `refunds_check`: CHECK ((((status)::text = ANY ((ARRAY['approved'::character varying, 'paid'::character varying])::text[])) = ((approved_by IS NOT NULL) AND (approved_at IS NOT NULL))))
- `refunds_check1`: CHECK ((((status)::text = 'paid'::text) = ((paid_by IS NOT NULL) AND (paid_at IS NOT NULL) AND (transfer_reference IS NOT NULL))))
- `refunds_refund_id_not_null`: NOT NULL refund_id
- `refunds_order_id_not_null`: NOT NULL order_id
- `refunds_payment_id_not_null`: NOT NULL payment_id
- `refunds_amount_not_null`: NOT NULL amount
- `refunds_reason_not_null`: NOT NULL reason
- `refunds_status_not_null`: NOT NULL status
- `refunds_pkey`: PRIMARY KEY (refund_id)
- `refunds_order_id_key`: UNIQUE (order_id)
- `refunds_payment_id_key`: UNIQUE (payment_id)
- `refunds_transfer_reference_key`: UNIQUE (transfer_reference)
- `refunds_order_id_fkey`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)
- `refunds_payment_id_fkey`: FOREIGN KEY (payment_id) REFERENCES owl.payments(payment_id)
- `refunds_paid_by_fkey`: FOREIGN KEY (paid_by) REFERENCES owl.users(user_id)

## seller_charges

| Column | Type | Required | Keys / target |
|---|---|---|---|
| charge_id | bigint | Yes | PK  |
| seller_id | bigint | Yes | FK → users.user_id |
| shipment_id | bigint | Yes | FK → shipments.shipment_id |
| amount | numeric(12,2) | Yes |  |
| reason | character varying(30) | Yes |  |
| status | character varying(20) | Yes |  |
| payment_reference | character varying(120) | No |  |
| recorded_by | bigint | Yes | FK → users.user_id |
| paid_at | timestamp with time zone | No |  |

Constraints:

- `seller_charges_amount_check`: CHECK ((amount >= (0)::numeric))
- `seller_charges_reason_check`: CHECK (((reason)::text = 'return_shipping'::text))
- `seller_charges_status_check`: CHECK (((status)::text = ANY ((ARRAY['unpaid'::character varying, 'paid'::character varying])::text[])))
- `seller_charges_check`: CHECK ((((status)::text = 'paid'::text) = ((payment_reference IS NOT NULL) AND (paid_at IS NOT NULL))))
- `seller_charges_charge_id_not_null`: NOT NULL charge_id
- `seller_charges_seller_id_not_null`: NOT NULL seller_id
- `seller_charges_shipment_id_not_null`: NOT NULL shipment_id
- `seller_charges_amount_not_null`: NOT NULL amount
- `seller_charges_reason_not_null`: NOT NULL reason
- `seller_charges_status_not_null`: NOT NULL status
- `seller_charges_recorded_by_not_null`: NOT NULL recorded_by
- `seller_charges_pkey`: PRIMARY KEY (charge_id)
- `seller_charges_shipment_id_key`: UNIQUE (shipment_id)
- `seller_charges_seller_id_fkey`: FOREIGN KEY (seller_id) REFERENCES owl.users(user_id)
- `seller_charges_shipment_id_fkey`: FOREIGN KEY (shipment_id) REFERENCES owl.shipments(shipment_id)
- `seller_charges_recorded_by_fkey`: FOREIGN KEY (recorded_by) REFERENCES owl.users(user_id)

## seller_offers

| Column | Type | Required | Keys / target |
|---|---|---|---|
| offer_id | bigint | Yes | PK  |
| seller_id | bigint | Yes | FK → users.user_id |
| variant_id | bigint | Yes | FK → product_variants.variant_id |
| condition | character varying(10) | Yes |  |
| condition_notes | text | Yes |  |
| defects | text | Yes |  |
| asking_price | numeric(12,2) | Yes |  |
| available_quantity | integer | Yes |  |
| status | character varying(20) | Yes |  |
| created_at | timestamp with time zone | Yes |  |
| review_decision | character varying(10) | No |  |
| reviewed_by | bigint | No | FK → users.user_id |
| review_reason | text | No |  |
| reviewed_at | timestamp with time zone | No |  |
| queue_group_id | bigint | No | FK → queue_groups.group_id |
| queue_position | bigint | No |  |
| skips_remaining | smallint | No |  |

Constraints:

- `seller_offers_condition_check`: CHECK (((condition)::text = ANY ((ARRAY['new'::character varying, 'used'::character varying])::text[])))
- `seller_offers_asking_price_check`: CHECK ((asking_price > (0)::numeric))
- `seller_offers_available_quantity_check`: CHECK ((available_quantity >= 0))
- `seller_offers_status_check`: CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'withdrawn'::character varying])::text[])))
- `seller_offers_review_decision_check`: CHECK (((review_decision)::text = ANY ((ARRAY['approve'::character varying, 'reject'::character varying])::text[])))
- `seller_offers_check`: CHECK ((((review_decision IS NULL) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)) OR ((review_decision IS NOT NULL) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL))))
- `seller_offers_check1`: CHECK ((((review_decision)::text IS DISTINCT FROM 'reject'::text) OR (length(TRIM(BOTH FROM review_reason)) > 0)))
- `seller_offers_check2`: CHECK ((((condition)::text <> 'used'::text) OR ((available_quantity <= 1) AND (length(TRIM(BOTH FROM defects)) > 0))))
- `seller_offers_offer_id_not_null`: NOT NULL offer_id
- `seller_offers_seller_id_not_null`: NOT NULL seller_id
- `seller_offers_variant_id_not_null`: NOT NULL variant_id
- `seller_offers_condition_not_null`: NOT NULL condition
- `seller_offers_condition_notes_not_null`: NOT NULL condition_notes
- `seller_offers_defects_not_null`: NOT NULL defects
- `seller_offers_asking_price_not_null`: NOT NULL asking_price
- `seller_offers_available_quantity_not_null`: NOT NULL available_quantity
- `seller_offers_status_not_null`: NOT NULL status
- `seller_offers_created_at_not_null`: NOT NULL created_at
- `seller_offers_pkey`: PRIMARY KEY (offer_id)
- `seller_offers_seller_id_fkey`: FOREIGN KEY (seller_id) REFERENCES owl.users(user_id)
- `seller_offers_variant_id_fkey`: FOREIGN KEY (variant_id) REFERENCES owl.product_variants(variant_id)
- `seller_offers_reviewed_by_fkey`: FOREIGN KEY (reviewed_by) REFERENCES owl.users(user_id)
- `offer_queue_unique`: UNIQUE (queue_group_id, queue_position)
- `seller_offers_queue_group_id_fkey`: FOREIGN KEY (queue_group_id) REFERENCES owl.queue_groups(group_id)
- `seller_offers_skips_remaining_check`: CHECK (((skips_remaining >= 0) AND (skips_remaining <= 3)))
- `offer_queue_complete`: CHECK ((num_nonnulls(queue_group_id, queue_position, skips_remaining) = ANY (ARRAY[0, 3])))

## sessions

| Column | Type | Required | Keys / target |
|---|---|---|---|
| session_id | bigint | Yes | PK  |
| user_id | bigint | Yes | FK → users.user_id |
| token_hash | character(64) | Yes |  |
| expires_at | timestamp with time zone | Yes |  |
| revoked_at | timestamp with time zone | No |  |

Constraints:

- `sessions_session_id_not_null`: NOT NULL session_id
- `sessions_user_id_not_null`: NOT NULL user_id
- `sessions_token_hash_not_null`: NOT NULL token_hash
- `sessions_expires_at_not_null`: NOT NULL expires_at
- `sessions_pkey`: PRIMARY KEY (session_id)
- `sessions_token_hash_key`: UNIQUE (token_hash)
- `sessions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES owl.users(user_id)

## shipments

| Column | Type | Required | Keys / target |
|---|---|---|---|
| shipment_id | bigint | Yes | PK  |
| order_id | bigint | Yes | FK → orders.order_id |
| leg | character varying(20) | Yes |  |
| carrier | character varying(80) | Yes |  |
| tracking_number | character varying(120) | Yes |  |
| status | character varying(20) | Yes |  |
| shipping_cost | numeric(12,2) | Yes |  |
| payer | character varying(10) | Yes |  |
| created_by | bigint | Yes | FK → users.user_id |
| shipped_at | timestamp with time zone | Yes |  |
| delivered_at | timestamp with time zone | No |  |

Constraints:

- `shipments_carrier_tracking_number_key`: UNIQUE (carrier, tracking_number)
- `shipments_leg_check`: CHECK (((leg)::text = ANY ((ARRAY['seller_to_hub'::character varying, 'hub_to_buyer'::character varying, 'hub_to_seller'::character varying])::text[])))
- `shipments_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES owl.users(user_id)
- `shipments_status_check`: CHECK (((status)::text = ANY ((ARRAY['in_transit'::character varying, 'delivered'::character varying])::text[])))
- `shipments_shipping_cost_check`: CHECK ((shipping_cost >= (0)::numeric))
- `shipments_payer_check`: CHECK (((payer)::text = ANY ((ARRAY['seller'::character varying, 'buyer'::character varying, 'platform'::character varying])::text[])))
- `shipments_check`: CHECK ((((status)::text = 'delivered'::text) = (delivered_at IS NOT NULL)))
- `shipments_check1`: CHECK ((((leg)::text <> 'hub_to_seller'::text) OR ((payer)::text = 'seller'::text)))
- `shipments_shipment_id_not_null`: NOT NULL shipment_id
- `shipments_order_item_id_not_null`: NOT NULL order_id
- `shipments_leg_not_null`: NOT NULL leg
- `shipments_carrier_not_null`: NOT NULL carrier
- `shipments_tracking_number_not_null`: NOT NULL tracking_number
- `shipments_status_not_null`: NOT NULL status
- `shipments_shipping_cost_not_null`: NOT NULL shipping_cost
- `shipments_payer_not_null`: NOT NULL payer
- `shipments_created_by_not_null`: NOT NULL created_by
- `shipments_shipped_at_not_null`: NOT NULL shipped_at
- `shipments_pkey`: PRIMARY KEY (shipment_id)
- `shipments_order_item_id_leg_key`: UNIQUE (order_id, leg)
- `shipments_order_fk`: FOREIGN KEY (order_id) REFERENCES owl.orders(order_id)

## users

| Column | Type | Required | Keys / target |
|---|---|---|---|
| user_id | bigint | Yes | PK  |
| full_name | character varying(100) | Yes |  |
| email | character varying(254) | Yes |  |
| phone | character varying(30) | No |  |
| password_hash | text | Yes |  |
| status | character varying(20) | Yes |  |
| created_at | timestamp with time zone | Yes |  |
| is_buyer | boolean | Yes |  |
| is_seller | boolean | Yes |  |
| is_admin | boolean | Yes |  |
| is_qc | boolean | Yes |  |
| bank_name | character varying(100) | No |  |
| account_holder | character varying(100) | No |  |
| account_number | character varying(50) | No |  |
| bank_verified | boolean | Yes |  |
| bank_archived | boolean | Yes |  |
| id_document_reference | text | No |  |
| bank_document_reference | text | No |  |
| verification_status | character varying(20) | No |  |
| verification_reviewer_id | bigint | No | FK → users.user_id |
| verification_review_note | text | No |  |
| verification_submitted_at | timestamp with time zone | No |  |
| verification_reviewed_at | timestamp with time zone | No |  |
| seller_display_name | character varying(100) | No |  |
| seller_status | character varying(20) | No |  |
| seller_since | timestamp with time zone | No |  |

Constraints:

- `users_email_check`: CHECK (((email)::text = lower((email)::text)))
- `users_status_check`: CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'closed'::character varying])::text[])))
- `users_verification_status_check`: CHECK (((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
- `users_check`: CHECK (((NOT bank_verified) OR ((bank_name IS NOT NULL) AND (account_holder IS NOT NULL) AND (account_number IS NOT NULL))))
- `users_check1`: CHECK (((verification_status IS NULL) OR ((id_document_reference IS NOT NULL) AND (bank_document_reference IS NOT NULL) AND (verification_submitted_at IS NOT NULL) AND ((((verification_status)::text = 'pending'::text) AND (verification_reviewer_id IS NULL) AND (verification_reviewed_at IS NULL)) OR (((verification_status)::text <> 'pending'::text) AND (verification_reviewer_id IS NOT NULL) AND (verification_reviewed_at IS NOT NULL))))))
- `users_seller_status_check`: CHECK (((seller_status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying])::text[])))
- `users_check2`: CHECK ((((seller_display_name IS NULL) AND (seller_status IS NULL) AND (seller_since IS NULL)) OR ((seller_display_name IS NOT NULL) AND (seller_status IS NOT NULL) AND (seller_since IS NOT NULL))))
- `users_user_id_not_null`: NOT NULL user_id
- `users_full_name_not_null`: NOT NULL full_name
- `users_email_not_null`: NOT NULL email
- `users_password_hash_not_null`: NOT NULL password_hash
- `users_status_not_null`: NOT NULL status
- `users_created_at_not_null`: NOT NULL created_at
- `users_is_buyer_not_null`: NOT NULL is_buyer
- `users_is_seller_not_null`: NOT NULL is_seller
- `users_is_admin_not_null`: NOT NULL is_admin
- `users_is_qc_not_null`: NOT NULL is_qc
- `users_bank_verified_not_null`: NOT NULL bank_verified
- `users_bank_archived_not_null`: NOT NULL bank_archived
- `users_pkey`: PRIMARY KEY (user_id)
- `users_email_key`: UNIQUE (email)
- `users_verification_reviewer_id_fkey`: FOREIGN KEY (verification_reviewer_id) REFERENCES owl.users(user_id)

## wishlist_items

| Column | Type | Required | Keys / target |
|---|---|---|---|
| user_id | bigint | Yes | PK FK → users.user_id |
| product_id | bigint | Yes | PK FK → products.product_id |
| added_at | timestamp with time zone | Yes |  |

Constraints:

- `wishlist_items_user_id_not_null`: NOT NULL user_id
- `wishlist_items_product_id_not_null`: NOT NULL product_id
- `wishlist_items_added_at_not_null`: NOT NULL added_at
- `wishlist_items_pkey`: PRIMARY KEY (user_id, product_id)
- `wishlist_items_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES owl.users(user_id)
- `wishlist_items_product_id_fkey`: FOREIGN KEY (product_id) REFERENCES owl.products(product_id)
