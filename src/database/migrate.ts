import mysql from 'mysql2/promise';
import { config } from '../config';
import logger from '../utils/logger';

const migrations = [
  // 钱包地址表
  `CREATE TABLE IF NOT EXISTS wallet_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    chain ENUM('BTC', 'ETH', 'BSC', 'TRX') NOT NULL,
    address VARCHAR(128) NOT NULL,
    derivation_path VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_chain (user_id, chain),
    UNIQUE KEY uk_address (address),
    INDEX idx_user_id (user_id),
    INDEX idx_chain (chain)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 充值记录表
  `CREATE TABLE IF NOT EXISTS deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    chain ENUM('BTC', 'ETH', 'BSC', 'TRX') NOT NULL,
    coin VARCHAR(20) NOT NULL,
    address VARCHAR(128) NOT NULL,
    tx_hash VARCHAR(128) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    confirmations INT DEFAULT 0,
    status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending',
    callback_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tx_hash (tx_hash),
    INDEX idx_user_id (user_id),
    INDEX idx_address (address),
    INDEX idx_status (status),
    INDEX idx_callback_status (callback_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 提现记录表
  `CREATE TABLE IF NOT EXISTS withdrawals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    chain ENUM('BTC', 'ETH', 'BSC', 'TRX') NOT NULL,
    coin VARCHAR(20) NOT NULL,
    from_address VARCHAR(128) NOT NULL,
    to_address VARCHAR(128) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    fee DECIMAL(36, 18) DEFAULT 0,
    tx_hash VARCHAR(128),
    status ENUM('pending', 'processing', 'confirmed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_tx_hash (tx_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 地址索引表（用于记录每个用户的派生索引）
  `CREATE TABLE IF NOT EXISTS address_indexes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chain ENUM('BTC', 'ETH', 'BSC', 'TRX') NOT NULL,
    next_index INT DEFAULT 0,
    UNIQUE KEY uk_chain (chain)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 初始化地址索引
  `INSERT IGNORE INTO address_indexes (chain, next_index) VALUES
    ('BTC', 0), ('ETH', 0), ('BSC', 0), ('TRX', 0)`,

  // API密钥表
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_api_key (api_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function runMigrations() {
  let connection: mysql.Connection | null = null;

  try {
    // 先连接不指定数据库，创建数据库
    connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
    });

    // 创建数据库
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${config.database.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    logger.info(`Database ${config.database.database} created or already exists`);

    // 关闭连接
    await connection.end();

    // 重新连接到指定数据库
    connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
    });

    // 运行迁移
    for (const migration of migrations) {
      await connection.execute(migration);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
