-- Database migration for improved billing analytics performance
-- Run these commands on your MySQL/MariaDB database

-- Add indexes to customer_numbers table for analytics queries
ALTER TABLE customer_numbers
ADD INDEX idx_prosbc_removed_date (prosbcInstanceId, removedDate),
ADD INDEX idx_prosbc_added_removed (prosbcInstanceId, addedDate, removedDate);

-- Add indexes to number_events table for analytics and reporting queries
ALTER TABLE number_events
ADD INDEX idx_prosbc_action_timestamp (prosbcInstanceId, action, timestamp),
ADD INDEX idx_customer_prosbc_timestamp (customerName, prosbcInstanceId, timestamp);

-- Optional: Add index to pending_removals for faster processing
ALTER TABLE pending_removals
ADD INDEX idx_prosbc_removal_date (prosbcInstanceId, removalDate);

-- Optional: Add index to customer_number_changes for audit queries
ALTER TABLE customer_number_changes
ADD INDEX idx_prosbc_timestamp (prosbcInstanceId, timestamp);

-- Verify indexes were created
SHOW INDEX FROM customer_numbers;
SHOW INDEX FROM number_events;
SHOW INDEX FROM pending_removals;
SHOW INDEX FROM customer_number_changes;