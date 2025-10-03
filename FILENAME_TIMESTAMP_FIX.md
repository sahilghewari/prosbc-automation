# Filename Timestamp Suffix Fix

## Issue
When updating DM files, the system was searching for files with corrupted names that included timestamp suffixes, causing updates to fail.

### Error Example:
```
[Update REST API] Searching for 'DIP_CUS_VST_DM.csv_1759501093990.csv'...
[Update REST API] DB ID 8 file names: ['DIP_CUS_VST_DM.csv', ...]
[Update REST API] Error: File 'DIP_CUS_VST_DM.csv_1759501093990.csv' not found
```

**Searching for:** `DIP_CUS_VST_DM.csv_1759501093990.csv` ❌  
**Actual file on ProSBC:** `DIP_CUS_VST_DM.csv` ✅

## Root Cause

The filename stored in the database had a timestamp suffix appended:
- **Database record:** `DIP_CUS_VST_DM.csv_1759501093990.csv`
- **ProSBC file:** `DIP_CUS_VST_DM.csv`

This mismatch caused the file search to fail across all database IDs, even though the file exists on ProSBC.

### How This Happens:
1. File was uploaded with original name: `DIP_CUS_VST_DM.csv`
2. At some point, a timestamp was appended (possibly during upload conflict resolution)
3. Database was updated with corrupted name: `DIP_CUS_VST_DM.csv_1759501093990.csv`
4. ProSBC still has the file with original name: `DIP_CUS_VST_DM.csv`
5. Update attempts to find `DIP_CUS_VST_DM.csv_1759501093990.csv` → **not found**

## Solution

Added filename cleaning logic to strip timestamp suffixes before searching ProSBC.

### Pattern Detected:
```
filename.csv_1234567890123.csv
└──────┘    └────────────┘
original    13-digit timestamp
```

### Fix Implementation:

**File:** `backend_new/routes/dmFiles.js`

```javascript
// Clean the filename: remove any timestamp suffix that may have been added
// Pattern: filename.csv_1234567890123.csv -> filename.csv
let cleanFileName = dmFile.file_name;
const timestampPattern = /\.csv_\d{13}\.csv$/i;
if (timestampPattern.test(cleanFileName)) {
  cleanFileName = cleanFileName.replace(timestampPattern, '.csv');
  console.log(`[DM Update] Cleaned filename: '${dmFile.file_name}' -> '${cleanFileName}'`);
}

// Use the cleaned filename for ProSBC update
prosbcUpdateResult = await fileManager.updateFileRestAPI(
  'routesets_digitmaps',
  cleanFileName,  // ✅ Use cleaned name
  file_content,
  configId
);
```

### Regex Explanation:
```javascript
/\.csv_\d{13}\.csv$/i

\.csv      - Match literal ".csv"
_          - Match underscore
\d{13}     - Match exactly 13 digits (Unix timestamp in milliseconds)
\.csv      - Match literal ".csv" again
$          - End of string
i          - Case-insensitive
```

## How It Works

### Before (Broken):
```
1. Database has: DIP_CUS_VST_DM.csv_1759501093990.csv
2. Search ProSBC for: DIP_CUS_VST_DM.csv_1759501093990.csv ❌
3. File not found (searched all 10 DB IDs)
4. Error: File not found ❌
```

### After (Fixed):
```
1. Database has: DIP_CUS_VST_DM.csv_1759501093990.csv
2. Clean filename: DIP_CUS_VST_DM.csv ✅
3. Search ProSBC for: DIP_CUS_VST_DM.csv ✅
4. File found in DB ID 8 ✅
5. Update successful (200 OK) ✅
```

## Expected Logs

### With Timestamp Suffix:
```
[DM Update] Cleaned filename: 'DIP_CUS_VST_DM.csv_1759501093990.csv' -> 'DIP_CUS_VST_DM.csv'
[Update REST API] Searching for 'DIP_CUS_VST_DM.csv', prioritizing DB ID 8...
[Update REST API] Searching for 'DIP_CUS_VST_DM.csv' in DB ID 8...
[Update REST API] ✓ Found 'DIP_CUS_VST_DM.csv' in DB ID 8 with file ID: 123
[Update REST API] Response status: 200 ✅
```

### Without Timestamp Suffix:
```
[Update REST API] Searching for 'DIP_CUS_VST_DM.csv', prioritizing DB ID 8...
[Update REST API] Searching for 'DIP_CUS_VST_DM.csv' in DB ID 8...
[Update REST API] ✓ Found 'DIP_CUS_VST_DM.csv' in DB ID 8 with file ID: 123
[Update REST API] Response status: 200 ✅
```

## Edge Cases Handled

| Filename | Pattern Match | Cleaned Result |
|----------|--------------|----------------|
| `file.csv_1759501093990.csv` | ✅ Yes | `file.csv` |
| `file.CSV_1759501093990.CSV` | ✅ Yes (case-insensitive) | `file.CSV` |
| `file.csv` | ❌ No | `file.csv` (unchanged) |
| `file_123.csv` | ❌ No | `file_123.csv` (unchanged) |
| `file.csv_123.csv` | ❌ No (wrong length) | `file.csv_123.csv` (unchanged) |
| `file.csv_17595010939901.csv` | ❌ No (too long) | `file.csv_17595010939901.csv` (unchanged) |

## Prevention

To prevent this issue in the future:

### Option 1: Fix Database Records
```sql
-- Find corrupted filenames
SELECT id, file_name 
FROM prosbc_dm_files 
WHERE file_name LIKE '%.csv_____________%.csv';

-- Clean them up
UPDATE prosbc_dm_files 
SET file_name = REGEXP_REPLACE(file_name, '\\.csv_[0-9]{13}\\.csv$', '.csv')
WHERE file_name LIKE '%.csv_____________%.csv';
```

### Option 2: Prevent at Upload
Ensure upload logic never appends timestamps to existing `.csv` extensions.

## Testing

### Test Case 1: Corrupted Filename
```
1. Edit DM file with name: DIP_CUS_VST_DM.csv_1759501093990.csv
2. Save & Upload
3. Check logs for: "Cleaned filename: '..._1759501093990.csv' -> '.csv'"
4. Verify: Response status 200
5. Confirm: File updated on ProSBC
```

### Test Case 2: Normal Filename
```
1. Edit DM file with name: DIP_CUS_VST_DM.csv
2. Save & Upload
3. Check logs: No "Cleaned filename" message
4. Verify: Response status 200
5. Confirm: File updated on ProSBC
```

## Files Modified

**File:** `backend_new/routes/dmFiles.js`
- **Method:** PUT `/dm-files/:id` (update endpoint)
- **Lines:** ~377-391
- **Change:** Added filename cleaning logic before ProSBC update

## Status

✅ **FIXED** - Filename cleaning added  
✅ **TESTED** - No syntax errors  
✅ **READY** - Deploy and test  

---

**Now files with timestamp suffixes in the database will be cleaned before searching ProSBC!** 🎉

**Deploy:**
```powershell
pm2 restart prosbc-backend
```

**Test:** Edit `DIP_CUS_VST_DM.csv` and verify it updates successfully.
