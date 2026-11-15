-- Development catalog only. Does not change historical orders or payment records.
BEGIN;
SET LOCAL search_path TO owl, public;

UPDATE products SET
  name=trim(regexp_replace(name,'\mDemo\M','','gi')),
  brand_name=CASE WHEN brand_name='Demo Brand' THEN 'Owl Studio' ELSE brand_name END,
  description='Clothing, footwear and accessories selected for the Owl Pai Lei catalog.'
WHERE name ILIKE '%demo%' OR brand_name='Demo Brand';
UPDATE products SET name=CASE category
  WHEN 'Shoes' THEN 'Owl Everyday Sneakers '
  WHEN 'Clothing' THEN 'Owl Everyday Shirt '
  ELSE 'Owl Everyday Accessory ' END||lpad(product_id::text,3,'0'),
  description='Selected for the Owl Pai Lei catalog.'
WHERE name LIKE 'Sample Catalog Product %';
UPDATE product_variants SET sku=replace(sku,'DEMO','CATALOG') WHERE sku LIKE '%DEMO%';
UPDATE users SET full_name=trim(regexp_replace(full_name,'\mDemo\M','','gi')),
  seller_display_name=CASE WHEN seller_display_name IS NULL THEN NULL
    ELSE trim(regexp_replace(seller_display_name,'\mDemo\M','','gi')) END
WHERE email IN ('seller1@owl.test','seller2@owl.test','buyer@owl.test','admin@owl.test','qc@owl.test');
UPDATE users SET phone='000000000'||user_id WHERE phone LIKE 'DEMO-PHONE-%';
UPDATE addresses SET recipient_name=trim(regexp_replace(recipient_name,'\mDemo\M','','gi')),
  phone=CASE WHEN phone LIKE 'DEMO-PHONE-%' THEN '000000000'||user_id ELSE phone END,
  district=CASE WHEN district='Demo District' THEN 'Bang Rak' ELSE district END
WHERE recipient_name ILIKE '%demo%' OR phone LIKE 'DEMO-PHONE-%' OR district='Demo District';

DO $catalog$
DECLARE a BIGINT; s1 BIGINT; s2 BIGINT; owner BIGINT; item RECORD; v RECORD;
  n INTEGER; missing INTEGER; created BIGINT; size_label TEXT; kind TEXT;
  label TEXT; category_label TEXT; price NUMERIC; sizes TEXT[];
BEGIN
 SELECT user_id INTO STRICT a FROM users WHERE email='admin@owl.test';
 SELECT user_id INTO STRICT s1 FROM users WHERE email='seller1@owl.test';
 SELECT user_id INTO STRICT s2 FROM users WHERE email='seller2@owl.test';
 SELECT greatest(0,200-count(*))::INTEGER INTO missing FROM products;
 FOR n IN 1..missing LOOP
   category_label:=(ARRAY['Shoes','Clothing','Accessories'])[((n-1)%3)+1];
   label:=CASE category_label
     WHEN 'Shoes' THEN (ARRAY['Owl Court Sneakers','Owl Trail Runners','Owl Canvas Low','Owl Retro Trainers'])[((n-1)%4)+1]
     WHEN 'Clothing' THEN (ARRAY['Owl Relaxed Tee','Owl Linen Overshirt','Owl Cotton Polo','Owl Crew Sweatshirt'])[((n-1)%4)+1]
     ELSE (ARRAY['Owl Shoulder Bag','Owl Canvas Tote','Owl Classic Cap','Owl Leather Belt'])[((n-1)%4)+1] END;
   INSERT INTO products(category,brand_name,name,description,created_by)
   VALUES(category_label,'Owl Studio',label||' Collection '||lpad(n::text,3,'0'),
     'Selected for the Owl Pai Lei catalog.',a);
 END LOOP;
 FOR item IN SELECT * FROM products WHERE active ORDER BY product_id LOOP
   sizes:=CASE item.category WHEN 'Shoes' THEN ARRAY['3','3.5','4','4.5','5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','11.5']
     WHEN 'Clothing' THEN ARRAY['S','M','L','XL'] ELSE ARRAY['One size'] END;
   FOREACH size_label IN ARRAY sizes LOOP
     INSERT INTO product_variants(product_id,size,color,sku)
     VALUES(item.product_id,size_label,'Standard','OPL-'||item.product_id||'-'||replace(size_label,' ','-'))
     ON CONFLICT(product_id,size,color) DO NOTHING;
   END LOOP;
   FOR v IN SELECT * FROM product_variants WHERE product_id=item.product_id AND active
     AND (item.category<>'Shoes' OR size IN ('8','9','10','11')) LOOP
     price:=CASE item.category WHEN 'Shoes' THEN 1800 WHEN 'Clothing' THEN 490 ELSE 350 END
       +(item.product_id%12)*70+(v.variant_id%4)*25;
     FOREACH owner IN ARRAY ARRAY[s1,s2] LOOP
       -- Add stock through the normal offer/approval workflow; never rewrite sold snapshots.
       IF NOT EXISTS(SELECT 1 FROM seller_offers WHERE variant_id=v.variant_id AND seller_id=owner
           AND condition='new' AND status='approved' AND available_quantity>=30) THEN
         created:=create_offer(owner,v.variant_id,'new',price+CASE WHEN owner=s2 THEN 90 ELSE 0 END,
           30,'','New item with original packaging');
         PERFORM review_offer(a,created,'approve','Catalog stock approved');
       END IF;
     END LOOP;
     SELECT greatest(0,2-count(*))::INTEGER INTO missing FROM seller_offers
       WHERE variant_id=v.variant_id AND condition='used' AND status='approved' AND available_quantity>0;
     FOR n IN 1..missing LOOP
       owner:=CASE WHEN n=1 THEN s1 ELSE s2 END;
       created:=create_offer(owner,v.variant_id,'used',round(price*0.65,2)+n*40,1,
         CASE WHEN n=1 THEN 'Small visible mark; see item condition before buying'
           ELSE 'Light signs of use on the edge' END,'Pre-owned item; sold as one piece');
       PERFORM review_offer(a,created,'approve','Individual item approved');
     END LOOP;
   END LOOP;
 END LOOP;
END;
$catalog$;
COMMIT;
