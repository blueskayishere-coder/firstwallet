import mysql from 'mysql2/promise';
import { config } from '../config';
import logger from '../utils/logger';

let pool: mysql.Pool | null = null;

export async function getConnection(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    logger.info('Database pool created');
  }
  return pool;
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const conn = await getConnection();
  const [rows] = await conn.execute(sql, params);
  return rows as T;
}

export default { getConnection, closeConnection, query };
