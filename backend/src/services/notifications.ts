import { query } from '../config/database';

let ioInstance: any = null;

export function setNotificationIO(io: any) {
  ioInstance = io;
}

interface SendNotificationParams {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
}

export async function sendNotification({ userId, type, title, message, link }: SendNotificationParams) {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, title, message || null, link || null]
  );

  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification', result.rows[0]);
  }

  return result.rows[0];
}
