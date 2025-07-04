# Database Setup for ProSBC NAP Testing Application

## Quick Start

This application now includes a comprehensive database system for NAP records, file metadata, edit history, and audit logs using MongoDB with Mongoose.

## Prerequisites

1. **MongoDB Installation**
   - Install MongoDB Community Edition from: https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas
   - Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo:latest`

2. **Environment Variables**
   Create a `.env` file in the project root with:
   ```
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/prosbc_nap
   
   # ProSBC API Credentials (existing)
   VITE_PROSBC_USERNAME=your_username
   VITE_PROSBC_PASSWORD=your_password
   ```

## Database Features

### 📊 **Core Collections**
- **NAP Records**: Complete NAP configurations with status tracking
- **File Metadata**: Uploaded file information with tags and validation
- **Edit History**: Full audit trail of file changes with rollback capability
- **Routeset Mapping**: Mapping between routeset files and NAP configurations
- **Activation Logs**: Deployment and activation tracking

### 🎛️ **UI Integration**
- **Database Widget**: Fixed bottom-right widget showing real-time status
- **Database Dashboard**: Full analytics and management interface
- **CSV Editor**: Integrated file history and rollback
- **Status Indicators**: Database connection status in navbar and components

### 🔧 **Advanced Features**
- **Real-time Status Monitoring**: Connection health checks every 30 seconds
- **Audit Trail**: Complete change tracking with user attribution
- **File Rollback**: Restore any previous version of edited files
- **Search & Filter**: Advanced database search across all collections
- **Bulk Operations**: Import/export and bulk management tools
- **Analytics**: Usage statistics and data insights

## Quick Setup

1. **Install MongoDB** (if not already installed)
2. **Start MongoDB Service**:
   ```bash
   # Windows
   net start MongoDB
   
   # macOS/Linux
   sudo systemctl start mongod
   # or
   brew services start mongodb-community
   ```

3. **Update Environment**: Add `MONGODB_URI` to your `.env` file

4. **Start Application**: The database will auto-initialize on first run
   ```bash
   npm run dev
   ```

## Database Access

### Via Application
- **Main Dashboard**: Click the database icon in the sidebar
- **Widget**: Click the bottom-right database status widget
- **Quick Access**: Use the floating database button (bottom-left)

### Via Code
```javascript
import { DatabaseService, quickAccess } from './src/database/index.js';

// Quick operations
const files = await quickAccess.searchFiles('query');
const naps = await quickAccess.searchNaps('query');

// Full service
const db = new DatabaseService();
const analytics = await db.getAnalytics('7d');
```

## File System Integration

Files are stored in a structured format:
```
/prosbc-files/
├── df/           # Definition Files
├── dm/           # Digit Map Files
├── nap/          # NAP configurations
└── temp/         # Temporary files
```

The database tracks all file operations with full versioning and audit trails.

## Troubleshooting

### Database Connection Issues
1. **Check MongoDB is running**: `mongo --eval 'db.stats()'`
2. **Verify connection string**: Check `MONGODB_URI` in `.env`
3. **View logs**: Check browser console for connection errors

### Widget Not Showing
1. **Clear browser cache**
2. **Check if database service is imported**
3. **Verify MongoDB is accessible**

### Performance Issues
1. **Index optimization**: Database auto-creates indexes for search performance
2. **Collection limits**: Large files are stored with GridFS
3. **Caching**: Frequently accessed data is cached in memory

## Security

- **Connection Security**: Uses MongoDB authentication when configured
- **Input Validation**: All database inputs are validated and sanitized
- **Audit Logging**: All operations are logged with user attribution
- **Access Control**: Ready for user-based permissions (extendable)

## Architecture

```
Frontend (React) ↔ Database Services ↔ MongoDB
                      ↕
              File System (Ubuntu)
```

- **Modular Design**: Database logic is separated into service classes
- **Error Handling**: Graceful degradation when database is unavailable
- **Scalability**: Ready for clustering and horizontal scaling
- **Extensibility**: Easy to add new collections and features

## Next Steps

1. **User Authentication**: Implement proper user management
2. **Real-time Updates**: Add WebSocket support for live updates
3. **Backup Strategy**: Implement automated database backups
4. **Advanced Analytics**: Add more detailed reporting and insights
5. **API Integration**: Expose REST API for external integrations

For detailed API documentation, see `/src/database/README.md`
