# Monthly Billing History Testing Guide

## 🔍 **System Overview**
The monthly billing history system uses **SIMPLE LOGIC** for billing calculations:
- **Live Count**: Current active numbers from ProSBC (removedDate IS NULL)
- **Billed Count**: Live count + numbers added during the month
- **Added Count**: Numbers added during the month (from NumberEvent)
- **Removed Count**: Numbers removed during the month (from NumberEvent)

**Simple Formula**: `Billed = Live + Added`

Data is stored in `MonthlyBillingSnapshot` table for historical months, with live calculation for current month.

## 🧪 **Testing Checklist**

### 1. **Database Setup Test**
```bash
# Check if MonthlyBillingSnapshot table exists
mysql -u app -p -h YOUR_HOST sbcapp -e "DESCRIBE monthly_billing_snapshots;"

# Check table structure
mysql -u app -p -h YOUR_HOST sbcapp -e "SHOW CREATE TABLE monthly_billing_snapshots;"

# Verify indexes
mysql -u app -p -h YOUR_HOST sbcapp -e "SHOW INDEX FROM monthly_billing_snapshots;"
```

### 2. **API Endpoint Tests**

#### **Test Historical Data Availability**
```bash
# Check available historical months
curl -X GET "http://localhost:3001/backend/api/customer-counts/historical?instanceId=prosbc1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### **Test Analytics for Current Month (Live Calculation)**
```bash
# Should return dataSource: "live_calculation"
curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### **Test Analytics for Past Month (Historical Snapshot)**
```bash
# First create a snapshot for a past month
curl -X POST "http://localhost:3001/backend/api/customer-counts/create-snapshots?instanceId=prosbc1&year=2025&month=9" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Then test analytics - should return dataSource: "historical_snapshot"
curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=9" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### **Test Monthly Report Generation**
```bash
curl -X GET "http://localhost:3001/backend/api/customer-counts/monthly-report?instanceId=prosbc1&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. **Data Integrity Tests**

#### **Verify Snapshot Data Accuracy**
```sql
-- Check snapshot data in database
SELECT
    year, month, customerName,
    billedCount, liveCount, addedCount, removedCount,
    snapshotDate
FROM monthly_billing_snapshots
WHERE prosbcInstanceId = 'prosbc1'
ORDER BY year DESC, month DESC, billedCount DESC
LIMIT 10;
```

#### **Compare Live vs Historical Data**
```bash
# Get current month live data
curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN" > live_data.json

# Create snapshot for current month
curl -X POST "http://localhost:3001/backend/api/customer-counts/create-snapshots?instanceId=prosbc1&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get same month as historical (should match live data)
curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN" > historical_data.json

# Compare the JSON responses - billedCount should match
```

### 4. **Frontend Testing**

#### **Dashboard Month/Year Selector**
1. Open the dashboard
2. Verify month/year dropdowns are visible
3. Select different months and verify data updates
4. Check "Data: Historical/Live" indicator changes correctly
5. Verify "Available months" count is displayed

#### **Billing Data Display**
1. Check that "Billed" column shows the correct amounts
2. Verify summary cards show accurate totals
3. Test CSV export functionality
4. Confirm data loads quickly for historical months

### 5. **Performance Tests**

#### **Response Time Comparison**
```bash
# Time historical data retrieval (should be fast)
time curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=9" \
  -H "Authorization: Bearer YOUR_TOKEN" -o /dev/null

# Time live calculation (may be slower)
time curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN" -o /dev/null
```

### 6. **Error Handling Tests**

#### **Test Invalid Month/Year**
```bash
# Should handle gracefully
curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=prosbc1&year=2025&month=13" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### **Test Non-existent Instance**
```bash
curl -X GET "http://localhost:3001/backend/api/customer-counts/analytics?instanceId=invalid&year=2025&month=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. **Business Logic Validation**

#### **Billing Calculation Verification (SIMPLE LOGIC)**
```sql
-- Verify SIMPLE BILLING LOGIC: billed = live + added
SELECT
    cn.customerName,
    -- Current live numbers (removedDate IS NULL)
    COUNT(DISTINCT CASE WHEN cn.removedDate IS NULL THEN cn.number END) as live_count,
    -- Numbers added during month
    COUNT(DISTINCT CASE WHEN cn.addedDate BETWEEN '2025-10-01' AND '2025-10-31 23:59:59' THEN cn.number END) as added_count,
    -- Expected billed = live + added
    COUNT(DISTINCT CASE WHEN cn.removedDate IS NULL THEN cn.number END) +
    COUNT(DISTINCT CASE WHEN cn.addedDate BETWEEN '2025-10-01' AND '2025-10-31 23:59:59' THEN cn.number END) as expected_billed
FROM customer_numbers cn
WHERE cn.prosbcInstanceId = 'prosbc1'
GROUP BY cn.customerName
ORDER BY expected_billed DESC
LIMIT 5;
```

#### **Compare with Snapshot Data (SIMPLE LOGIC)**
```sql
-- Compare simple calculation with snapshot: billed should equal live + added
SELECT
    mbs.customerName,
    mbs.liveCount,
    mbs.addedCount,
    mbs.billedCount as snapshot_billed,
    (mbs.liveCount + mbs.addedCount) as calculated_billed,
    CASE WHEN mbs.billedCount = (mbs.liveCount + mbs.addedCount) THEN 'MATCH' ELSE 'MISMATCH' END as verification
FROM monthly_billing_snapshots mbs
WHERE mbs.prosbcInstanceId = 'prosbc1'
    AND mbs.year = 2025
    AND mbs.month = 10
ORDER BY mbs.billedCount DESC
LIMIT 5;
```

## ✅ **Success Criteria**

### **Database Level**
- [ ] `monthly_billing_snapshots` table exists with correct structure
- [ ] All required indexes are present
- [ ] Sample snapshot data exists and looks reasonable

### **API Level**
- [ ] `/historical` endpoint returns available months
- [ ] `/analytics` returns correct data source indicator
- [ ] Historical data loads faster than live calculations
- [ ] `/create-snapshots` successfully creates snapshot data
- [ ] `/monthly-report` generates detailed reports

### **Frontend Level**
- [ ] Month/year selector works and updates data
- [ ] Historical vs Live indicator displays correctly
- [ ] Billing amounts are displayed prominently
- [ ] CSV export includes correct data

### **Data Accuracy**
- [ ] Live calculations match manual SQL queries
- [ ] Snapshot data matches live calculations for same period
- [ ] Billing totals are consistent across different views
- [ ] No duplicate or missing data in snapshots

### **Performance**
- [ ] Historical data loads in < 500ms
- [ ] Live calculations complete in < 3000ms
- [ ] Frontend updates smoothly when changing months

## 🚨 **Troubleshooting**

### **Common Issues & Fixes**

1. **"NumberEvent is not defined" Error**
   ```javascript
   // Check imports in customerCounts.js
   import NumberEvent from '../models/NumberEvent.js';
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   mysql -u app -p -h YOUR_HOST sbcapp -e "SELECT 1;"
   ```

3. **Missing Snapshot Data**
   ```bash
   # Create snapshots for missing months
   curl -X POST "http://localhost:3001/backend/api/customer-counts/create-snapshots?instanceId=prosbc1&year=2025&month=9" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Inconsistent Data**
   ```sql
   # Check for data anomalies
   SELECT year, month, COUNT(*) as snapshots
   FROM monthly_billing_snapshots
   WHERE prosbcInstanceId = 'prosbc1'
   GROUP BY year, month
   ORDER BY year DESC, month DESC;
   ```

## 📊 **Monitoring Queries**

```sql
-- Daily snapshot health check
SELECT
    DATE(snapshotDate) as date,
    COUNT(*) as snapshots_created,
    SUM(billedCount) as total_billed
FROM monthly_billing_snapshots
WHERE prosbcInstanceId = 'prosbc1'
    AND snapshotDate >= CURDATE() - INTERVAL 7 DAY
GROUP BY DATE(snapshotDate)
ORDER BY date DESC;

-- Data consistency check
SELECT
    'Total Customers' as metric,
    COUNT(DISTINCT customerName) as value
FROM monthly_billing_snapshots
WHERE prosbcInstanceId = 'prosbc1'
UNION ALL
SELECT
    'Total Snapshots' as metric,
    COUNT(*) as value
FROM monthly_billing_snapshots
WHERE prosbcInstanceId = 'prosbc1'
UNION ALL
SELECT
    'Avg Billed per Customer' as metric,
    ROUND(AVG(billedCount), 0) as value
FROM monthly_billing_snapshots
WHERE prosbcInstanceId = 'prosbc1';
```

This comprehensive testing guide will help you verify that the monthly billing history system is working perfectly! 🎯