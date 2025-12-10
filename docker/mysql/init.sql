-- 钱包地址表
CREATE TABLE IF NOT EXISTS wallet_addresses (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 充值记录表
CREATE TABLE IF NOT EXISTS deposits (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 提现记录表
CREATE TABLE IF NOT EXISTS withdrawals (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 地址索引表
CREATE TABLE IF NOT EXISTS address_indexes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chain ENUM('BTC', 'ETH', 'BSC', 'TRX') NOT NULL,
  next_index INT DEFAULT 0,
  UNIQUE KEY uk_chain (chain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化地址索引
INSERT INTO address_indexes (chain, next_index) VALUES
  ('BTC', 0), ('ETH', 0), ('BSC', 0), ('TRX', 0);

-- API密钥表
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_key VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
