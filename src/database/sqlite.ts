import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

const dbPath = path.join(process.cwd(), 'data', 'wallet.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    logger.info(`SQLite database connected: ${dbPath}`);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('SQLite database closed');
  }
}

export function query<T>(sql: string, params?: unknown[]): T {
  const database = getDatabase();

  const isSelect = sql.trim().toLowerCase().startsWith('select');

  if (isSelect) {
    const stmt = database.prepare(sql);
    return (params ? stmt.all(...params) : stmt.all()) as T;
  } else {
    const stmt = database.prepare(sql);
    const result = params ? stmt.run(...params) : stmt.run();
    return { insertId: result.lastInsertRowid, affectedRows: result.changes } as T;
  }
}

// 初始化数据库表
export function initDatabase(): void {
  const database = getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS wallet_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      chain TEXT NOT NULL CHECK(chain IN ('BTC', 'ETH', 'BSC', 'TRX')),
      address TEXT NOT NULL,
      derivation_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, chain),
      UNIQUE(address)
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      chain TEXT NOT NULL CHECK(chain IN ('BTC', 'ETH', 'BSC', 'TRX')),
      coin TEXT NOT NULL,
      address TEXT NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      amount TEXT NOT NULL,
      confirmations INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
      callback_status TEXT DEFAULT 'pending' CHECK(callback_status IN ('pending', 'success', 'failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      chain TEXT NOT NULL CHECK(chain IN ('BTC', 'ETH', 'BSC', 'TRX')),
      coin TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      fee TEXT DEFAULT '0',
      tx_hash TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'confirmed', 'failed')),
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS address_indexes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain TEXT NOT NULL UNIQUE CHECK(chain IN ('BTC', 'ETH', 'BSC', 'TRX')),
      next_index INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO address_indexes (chain, next_index) VALUES ('BTC', 0);
    INSERT OR IGNORE INTO address_indexes (chain, next_index) VALUES ('ETH', 0);
    INSERT OR IGNORE INTO address_indexes (chain, next_index) VALUES ('BSC', 0);
    INSERT OR IGNORE INTO address_indexes (chain, next_index) VALUES ('TRX', 0);
  `);

  logger.info('SQLite database initialized');
}

export default { getDatabase, closeDatabase, query, initDatabase };
