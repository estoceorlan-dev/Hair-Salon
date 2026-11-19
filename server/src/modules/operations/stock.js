import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { requirePermission } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { post, missing } from './shared.js'

const product=z.object({sku:z.string().trim().min(1).max(40),name:z.string().trim().min(1).max(100),
  category:z.string().trim().min(1).max(100),unit:z.string().trim().min(1).max(30),
  minimum:z.number().nonnegative().max(1e8),price:z.number().int().nonnegative().max(1e9).nullable()})
export const productSelect=`SELECT p.*,coalesce(b.quantity,0) AS stock FROM salon.products p LEFT JOIN salon.stock_balances b ON b.product_id=p.id`
export async function movement(c,{product,delta,type,reference,actor,reason,item=null}) {
  await c.query(`INSERT INTO salon.inventory_movements(product_id,quantity_delta,source_type,source_reference,actor_id,reason,sale_item_id)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[product,delta,type,reference,actor,reason,item])
}
export function stockRoutes(router,db) {
  const allow=requirePermission('inventory.manage'),id=validate(z.object({id:z.uuid()}),'params')
  router.get('/inventory',allow,async(req,res)=>res.json({items:(await db.query(productSelect+' WHERE p.is_active ORDER BY lower(p.name)')).rows}))
  async function save(req,res) {
    const d=req.validated.body, params=[d.sku,d.name,d.category,d.unit,d.minimum,d.price,d.price!==null]
    const item=await post(db,req,'inventory.product',async c=>{
      const sql=req.params.id?`UPDATE salon.products SET sku=$1,name=$2,category=$3,stock_unit=$4,minimum_stock=$5,retail_price_cents=$6,is_retail=$7,updated_at=now() WHERE id=$8 RETURNING *`:
      `INSERT INTO salon.products(sku,name,category,stock_unit,minimum_stock,retail_price_cents,is_retail) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`
      const row=(await c.query(sql,req.params.id?[...params,req.params.id]:params)).rows[0]
      if (!row) throw missing()
      return row
    })
    res.json({item})
  }
  router.post('/inventory',allow,validate(product),save)
  router.put('/inventory/:id',allow,id,validate(product),save)
  router.post('/inventory/:id/movements',allow,id,validate(z.object({delta:z.number().min(-1e8).max(1e8).multipleOf(0.001).refine(v=>v!==0),reason:z.string().trim().min(2).max(300)})),async(req,res)=>{
    const d=req.validated.body
    res.json(await post(db,req,'inventory.movement',async c=>{
      await movement(c,{product:req.params.id,delta:d.delta,type:d.delta>0?'restock':'adjustment',reference:randomUUID(),actor:req.auth.user.id,reason:d.reason})
      return {id:req.params.id}
    }))
  })
  router.get('/inventory/supplies/recipes',allow,async(req,res)=>res.json({items:(await db.query('SELECT sp.*,s.name AS service,p.name AS product,p.stock_unit FROM salon.service_products sp JOIN salon.services s ON s.id=sp.service_id JOIN salon.products p ON p.id=sp.product_id ORDER BY s.name,p.name')).rows}))
  router.put('/inventory/supplies/recipes',allow,validate(z.object({service:z.uuid(),product:z.uuid(),quantity:z.number().min(0).max(1e7).multipleOf(.001)})),async(req,res)=>{
    const d=req.validated.body
    res.json(await post(db,req,'inventory.recipe',async c=>{
      if (d.quantity===0) await c.query('DELETE FROM salon.service_products WHERE service_id=$1 AND product_id=$2',[d.service,d.product])
      else await c.query(`INSERT INTO salon.service_products(service_id,product_id,quantity,definition_state) VALUES($1,$2,$3,'confirmed')
        ON CONFLICT(service_id,product_id) DO UPDATE SET quantity=excluded.quantity,definition_state='confirmed'`,[d.service,d.product,d.quantity])
      return {id:d.service}
    }))
  })
}
