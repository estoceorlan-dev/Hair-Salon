import { transaction } from '../../db/connection.js'
import { HttpError } from '../../middleware/errors.js'

export const conflict = (message) => new HttpError(409, 'CONFLICT', message)
export const missing = () => new HttpError(404, 'NOT_FOUND', 'Record not found.')
export async function post(db, req, action, fn) {
  try {
    return await transaction(db, async client => {
      const result = await fn(client)
      await client.query('INSERT INTO salon.activity_logs(actor_id,action,entity_type,entity_reference) VALUES($1,$2,$3,$4)',
        [req.auth.user.id, action, action.split('.')[0], result.id])
      return result
    })
  } catch (err) {
    if (err.code === '23P01') throw conflict('This time has just been booked. Choose another slot.')
    if (err.code === '23514') throw conflict('This change exceeds the available stock or permitted amount.')
    if (err.code === '23505') throw conflict('This record already exists.')
    if (err.code === '23503') throw conflict('A linked record has changed. Refresh and try again.')
    throw err
  }
}
