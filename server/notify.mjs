import { run, id } from './db.mjs'

/** Create an in-app notification for a user (id or user row). */
export function notify(user, { type, title, body = '', message, link = null }) {
  const text = message ?? body ?? ''
  run(
    `INSERT INTO notifications (id, user_id, type, title, body, message, link, action_url, is_read)
     VALUES (?,?,?,?,?,?,?,?,0)`,
    id(), typeof user === 'string' ? user : user.id, type, title, text, text, link, link,
  )
}
