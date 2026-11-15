import pg from 'pg';
import assert from 'node:assert/strict';
if (!process.env.DATABASE_URL) throw Error('Set DATABASE_URL to the database to check. Test changes are rolled back.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,options:'-c search_path=owl,public'});
await db.connect();
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const runId=Date.now();
try {
  assert.equal(Number((await q("SELECT count(*) n FROM information_schema.tables WHERE table_schema='owl' AND table_type='BASE TABLE'"))[0].n),21);
  for(const v of ['public_market','seller_qc_scores','seller_sales','buyer_orders','eligible_payouts','admin_finance_summary']) await q(`SELECT * FROM ${v} LIMIT 2`);
  for(const scenario of ['complete','qc_fail','cancel_paid','cancel_unpaid','used']) {
    await q('BEGIN');
    try {
      const users=await q('SELECT user_id,email FROM users');
      const id=email=>users.find(u=>u.email===email).user_id;
      const buyer=id('buyer@owl.test'),admin=id('admin@owl.test'),qc=id('qc@owl.test');
      const a=(await q('SELECT address_id FROM addresses WHERE user_id=$1 AND NOT archived LIMIT 1',[buyer]))[0].address_id;
      const m=(await q("SELECT m.*,f.seller_id FROM public_market m JOIN seller_offers f USING(offer_id) WHERE m.condition=$1 ORDER BY m.offer_id LIMIT 1",[scenario==='used'?'used':'new']))[0];
      const order=(await q('SELECT checkout_selected($1,$2,$3,$4,NULL,$5) id',[buyer,m.variant_id,m.condition,a,m.offer_id]))[0].id;
      if(scenario!=='cancel_unpaid') {
        const stock=(await q('SELECT available_quantity FROM seller_offers WHERE offer_id=$1',[m.offer_id]))[0].available_quantity;
        const reference='merge-check-'+runId+'-'+scenario;
        await q('SELECT confirm_payment($1,$2,$3)',[admin,order,reference]);
        await q('SELECT confirm_payment($1,$2,$3)',[admin,order,reference]);
        assert.equal((await q('SELECT available_quantity FROM seller_offers WHERE offer_id=$1',[m.offer_id]))[0].available_quantity,stock-1);
        if(m.condition==='new') assert.notEqual((await q('SELECT active_offer_id FROM queue_groups WHERE variant_id=$1 AND condition=$2',[m.variant_id,'new']))[0].active_offer_id,m.offer_id);
      }
      if(scenario.startsWith('cancel')) {
        await q('SELECT request_cancellation($1,$2,$3)',[buyer,order,'Testing cancellation']);
        await q('SELECT review_cancellation($1,$2,true)',[admin,order]);
      } else {
        await q('SELECT create_shipment($1,$2,$3,$4,$5)',[m.seller_id,order,'seller_to_hub','TestCarrier','merge-in-'+runId+'-'+scenario]);
        await q('SELECT receive_at_hub($1,$2)',[qc,order]);
        await q('SELECT record_qc($1,$2,$3,$4,$5,$6)',[qc,order,scenario==='qc_fail'?'fail':'pass',scenario==='qc_fail'?1:5,'Inspection test',['evidence://test']]);
        if(scenario==='qc_fail') {
          await q('SELECT create_shipment($1,$2,$3,$4,$5,$6)',[qc,order,'hub_to_seller','TestCarrier','merge-return-'+runId,50]);
          await q('SELECT confirm_seller_return($1,$2)',[qc,order]);
        } else {
          await q('SELECT create_shipment($1,$2,$3,$4,$5)',[admin,order,'hub_to_buyer','TestCarrier','merge-out-'+runId+'-'+scenario]);
          await q('SELECT confirm_receipt($1,$2)',[buyer,order]);
          const payout=(await q('SELECT create_payout($1,$2,$2) id',[admin,m.seller_id]))[0].id;
          await q('SELECT approve_payout($1,$2)',[admin,payout]);
          await q('SELECT record_payout_paid($1,$2,$3)',[admin,payout,'merge-payout-'+runId+'-'+scenario]);
        }
      }
      if(scenario==='qc_fail'||scenario==='cancel_paid') {
        const refund=(await q('SELECT refund_id FROM refunds WHERE order_id=$1',[order]))[0].refund_id;
        await q('SELECT approve_refund($1,$2)',[admin,refund]);
        await q('SELECT record_refund_paid($1,$2,$3)',[admin,refund,'merge-refund-'+runId+'-'+scenario]);
      }
      await q('SET CONSTRAINTS ALL IMMEDIATE');
      console.log(scenario+': passed');
    } finally {await q('ROLLBACK');}
  }
} finally {await db.end();}



