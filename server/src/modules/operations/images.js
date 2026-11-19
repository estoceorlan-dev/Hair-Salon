import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import express from 'express'
import { z } from 'zod'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { validate } from '../../middleware/validate.js'
import { requirePermission } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errors.js'
import { post, missing } from './shared.js'

function storage(config) {
  const env=process.env, Bucket=env.NEON_STORAGE_BUCKET
  if (Bucket && env.AWS_ENDPOINT_URL_S3 && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION) {
    const s3=new S3Client({region:env.AWS_REGION,endpoint:env.AWS_ENDPOINT_URL_S3,forcePathStyle:true,
      credentials:{accessKeyId:env.AWS_ACCESS_KEY_ID,secretAccessKey:env.AWS_SECRET_ACCESS_KEY}})
    return {put:(Key,Body)=>s3.send(new PutObjectCommand({Bucket,Key,Body,ContentType:'image/webp'})),
      get:async Key=>Buffer.from(await (await s3.send(new GetObjectCommand({Bucket,Key}))).Body.transformToByteArray()),
      remove:Key=>s3.send(new DeleteObjectCommand({Bucket,Key}))}
  }
  if (config.nodeEnv==='production' || Bucket) throw new HttpError(503,'STORAGE_UNAVAILABLE','Image storage needs configuration.')
  const dir=fileURLToPath(new URL('../../../../.local-runtime/images/',import.meta.url))
  return {put:async(key,data)=>{await mkdir(dir,{recursive:true});await writeFile(path.join(dir,key),data)},
    get:key=>readFile(path.join(dir,key)),remove:key=>unlink(path.join(dir,key))}
}
export function imageRoutes(router,db,config) {
  const id=validate(z.object({id:z.uuid()}),'params')
  router.put('/images/:id',requirePermission('services.manage'),id,express.json({limit:'4.1mb'}),validate(z.object({image:z.string().min(1).max(4194304)})),async(req,res)=>{
    const input=Buffer.from(req.validated.body.image,'base64')
    let body
    try {
      const img=sharp(input,{limitInputPixels:24000000,failOn:'warning'})
      if (!['jpeg','png','webp'].includes((await img.metadata()).format)) throw Error()
      body=await img.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer()
    } catch { throw new HttpError(422,'INVALID_IMAGE','Choose a valid JPEG, PNG or WebP under 24 megapixels.') }
    const files=storage(config),key=randomUUID()+'.webp'
    let old
    await files.put(key,body)
    try {
      await post(db,req,'service.image',async client=>{
        const row=(await client.query('SELECT image_key FROM salon.services WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
        if (!row) throw missing()
        old=row.image_key
        await client.query('UPDATE salon.services SET image_key=$2 WHERE id=$1',[req.params.id,key])
        return {id:req.params.id}
      })
    } catch(err) {await files.remove(key).catch(()=>{});throw err}
    if (old) await files.remove(old).catch(()=>{})
    res.json({saved:true})
  })
  router.get('/images/:id',requirePermission('services.manage','appointments.own','appointments.manage','sales.manage'),id,async(req,res)=>{
    const row=(await db.query('SELECT image_key FROM salon.services WHERE id=$1 AND (is_active OR $2)',[req.params.id,req.auth.user.permissions.includes('services.manage')])).rows[0]
    if (!row?.image_key) throw missing()
    res.type('image/webp').send(await storage(config).get(row.image_key))
  })
}
