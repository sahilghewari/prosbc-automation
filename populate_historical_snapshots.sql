-- Script to populate historical billing snapshots
-- This will create snapshots for the last 12 months of data
-- Run this after creating the monthly_billing_snapshots table

-- Example: Populate snapshots for prosbc1 instance for the last 12 months
-- Adjust the instance ID and date range as needed

DELIMITER //

CREATE PROCEDURE populate_historical_snapshots(IN target_instance VARCHAR(50), IN months_back INT)
BEGIN
    DECLARE current_year INT;
    DECLARE current_month INT;
    DECLARE target_year INT;
    DECLARE target_month INT;
    DECLARE counter INT DEFAULT 0;

    SET current_year = YEAR(CURDATE());
    SET current_month = MONTH(CURDATE());

    WHILE counter < months_back DO
        -- Calculate target year/month (go backwards)
        SET target_month = current_month - counter;
        SET target_year = current_year;

        IF target_month <= 0 THEN
            SET target_month = target_month + 12;
            SET target_year = target_year - 1;
        END IF;

        -- Call the snapshot creation (this would need to be done via API call)
        -- For now, this is a placeholder - you'll need to call the API endpoint
        -- POST /customer-counts/create-snapshots?instanceId=prosbc1&year=2024&month=10

        SET counter = counter + 1;
    END WHILE;
END //

DELIMITER ;

-- Example usage:
-- CALL populate_historical_snapshots('prosbc1', 12);

-- Alternative: Manual snapshot creation for specific months
-- Make API calls to:
-- POST /backend/api/customer-counts/create-snapshots?instanceId=prosbc1&year=2024&month=10
-- POST /backend/api/customer-counts/create-snapshots?instanceId=prosbc1&year=2024&month=9
-- etc.

-- Check existing snapshots
SELECT
    year,
    month,
    COUNT(*) as customers,
    SUM(billedCount) as total_billed,
    MAX(snapshotDate) as last_updated
FROM monthly_billing_snapshots
WHERE prosbcInstanceId = 'prosbc1'
GROUP BY year, month
ORDER BY year DESC, month DESC;