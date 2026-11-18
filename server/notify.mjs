import { run, id } from './db.mjs'

/** Create an in-app notification for a user (id or user row). */
export function notify(user, { type, title, body, link = null }) {
  run(
    'INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?,?,?,?,?,?)',
    id(), typeof user === 'string' ? user : user.id, type, title, body, link,
  )
}
