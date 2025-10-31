-- Create MonthlyBillingSnapshot table for storing historical billing data
-- Run this on your MySQL/MariaDB database

CREATE TABLE IF NOT EXISTS monthly_billing_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  customerName VARCHAR(255) NOT NULL,
  prosbcInstanceId VARCHAR(50) NOT NULL,

  -- Billing metrics
  billedCount INT NOT NULL DEFAULT 0 COMMENT 'Total unique numbers billed for the month',
  liveCount INT NOT NULL DEFAULT 0 COMMENT 'Numbers still active at end of month',
  addedCount INT NOT NULL DEFAULT 0 COMMENT 'Numbers added during the month',
  removedCount INT NOT NULL DEFAULT 0 COMMENT 'Numbers removed during the month',

  -- Metadata
  snapshotDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When this snapshot was created',
  billingPeriodStart DATETIME NOT NULL COMMENT 'Start of billing period',
  billingPeriodEnd DATETIME NOT NULL COMMENT 'End of billing period',

  -- Detailed data for auditing
  billedNumbers JSON NULL COMMENT 'List of all numbers that were billed',
  monthlyEvents JSON NULL COMMENT 'Summary of add/remove events during the month',

  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  UNIQUE KEY unique_monthly_billing_snapshot (year, month, customerName, prosbcInstanceId),
  KEY idx_prosbc_year_month (prosbcInstanceId, year, month),
  KEY idx_customer_prosbc (customerName, prosbcInstanceId),
  KEY idx_snapshot_date (snapshotDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table creation
DESCRIBE monthly_billing_snapshots;
SHOW INDEX FROM monthly_billing_snapshots;