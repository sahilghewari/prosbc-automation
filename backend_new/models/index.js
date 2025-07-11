import User from './User.js';
import NAP from './NAP.js';
import DigitMap from './DigitMap.js';
import DialFormat from './DialFormat.js';
import AuditLog from './AuditLog.js';

const db = {};
db.User = User;
db.NAP = NAP;
db.DigitMap = DigitMap;
db.DialFormat = DialFormat;
db.AuditLog = AuditLog;

export default db;