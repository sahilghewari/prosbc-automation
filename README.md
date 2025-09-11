# ProSBC Automation System

A comprehensive automation platform for managing ProSBC (Professional Session Border Controller) systems with advanced file management, NAP (Network Access Point) operations, and multi-instance support.

## 🚀 Features

### 🔧 Core Functionality
- **Multi-ProSBC Instance Support** - Manage multiple ProSBC instances simultaneously
- **Advanced File Management** - Upload, validate, and manage DM (Digit Map) and DF (Dial Format) files
- **NAP Operations** - Create, edit, and manage Network Access Points
- **Routeset Mapping** - Intelligent mapping between DM and DF files
- **Activation Generation** - Automated activation file generation
- **Database Dashboard** - Comprehensive database management interface

### 🎯 Advanced Capabilities
- **Session Pooling** - Optimized session management with automatic cleanup
- **Configuration Caching** - Smart config selection with state tracking
- **Connection Pooling** - HTTP keep-alive connections with rate limiting
- **Real-time Validation** - Live file validation with scoring system
- **Intelligent Mapping** - AI-powered suggestions for file relationships
- **Performance Monitoring** - Comprehensive performance analytics

### 🔐 Security & Authentication
- **JWT Authentication** - Secure token-based authentication
- **Multi-factor Security** - Enhanced security with session management
- **Instance Isolation** - Secure separation between ProSBC instances
- **Audit Logging** - Comprehensive activity tracking

## 📁 Project Structure

```
prosbc-automation/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── FileManagement.jsx
│   │   │   ├── NapCreatorEnhanced.jsx
│   │   │   ├── RoutesetMapping.jsx
│   │   │   ├── DatabaseDashboard.jsx
│   │   │   └── ProSBCInstanceManager.jsx
│   │   ├── contexts/           # React contexts
│   │   ├── services/           # API services
│   │   ├── utils/              # Utility functions
│   │   └── App.jsx             # Main application
│   ├── public/                 # Static assets
│   └── package.json            # Frontend dependencies
├── backend_new/                # Node.js backend application
│   ├── routes/                 # API routes
│   │   ├── prosbcInstances.js
│   │   ├── prosbcFileManager.js
│   │   ├── routesetMapping.js
│   │   └── auth.js
│   ├── models/                 # Database models
│   ├── services/               # Business logic
│   ├── utils/                  # Utility functions
│   │   └── prosbc/            # ProSBC integration
│   │       ├── optimized/     # Performance optimizations
│   │       └── multiInstanceManager.js
│   └── server.js              # Main server file
├── documentation/              # Project documentation
└── package.json               # Root package.json
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- MySQL/MariaDB database
- ProSBC server access

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd prosbc-automation
```

2. **Install dependencies**
```bash
# Install all dependencies (recommended)
npm run setup

# Or install separately
npm install
npm run install:frontend
npm run install:backend
```

3. **Configure environment variables**
```bash
# Create .env file in root directory
cp .env.example .env

# Configure your ProSBC instances
PROSBC_URL=https://your-prosbc-server.com
JWT_SECRET=your-secret-key
DB_HOST=localhost
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=prosbc_automation
```

4. **Initialize database**
```bash
cd backend_new
npm run init-db
```

5. **Start development servers**
```bash
# Start both frontend and backend
npm run dev

# Or start separately
npm run dev:frontend  # Frontend on http://localhost:5173
npm run dev:backend   # Backend on http://localhost:3001
```

## 🎮 Usage

### Multi-ProSBC Instance Management

The system supports multiple ProSBC instances with intelligent management:

```javascript
// Instance-specific operations
const nycFileAPI = createProSBCFileAPI(1);  // ProSBC NYC1
const tpaFileAPI = createProSBCFileAPI(3);  // ProSBC TPA2

// Fetch NAPs for specific instance
const nycNaps = await fetchExistingNapsByInstance('config_1', 1);
const tpaNaps = await fetchExistingNapsByInstance('config_1', 3);
```

### File Management

Upload and manage DM/DF files with advanced validation:

1. **Navigate to File Management** in the sidebar
2. **Upload CSV files** with automatic format detection
3. **Review validation scores** and warnings
4. **Apply intelligent mappings** between DM and DF files

### NAP Operations

Create and manage Network Access Points:

1. **Access NAP Creator** from the main menu
2. **Configure NAP settings** with real-time validation
3. **Upload associated files** (DM/DF)
4. **Generate activation files** automatically

### Database Dashboard

Comprehensive database management interface:

- **NAPs Tab**: Manage Network Access Points
- **Digit Maps Tab**: Upload and manage DM CSV files
- **Dial Formats Tab**: Upload and manage DF CSV files
- **File Mappings Tab**: Create DM-DF-NAP relationships
- **ProSBC Files Tab**: Sync and import from ProSBC system

## 🔧 API Endpoints

### Authentication
- `POST /backend/api/auth/login` - User authentication
- `GET /backend/api/auth/profile` - Get user profile

### ProSBC Instances
- `GET /backend/api/prosbc-instances` - List all instances
- `GET /backend/api/prosbc-instances/:id` - Get specific instance
- `POST /backend/api/prosbc-instances/:id/test` - Test connection

### File Management
- `POST /backend/api/files/upload` - Upload files
- `GET /backend/api/files/dm` - Get DM files
- `GET /backend/api/files/df` - Get DF files
- `POST /backend/api/files/mapping` - Create file mappings

### NAP Operations
- `POST /backend/api/naps` - Create NAP
- `GET /backend/api/naps` - List NAPs
- `PUT /backend/api/naps/:id` - Update NAP
- `DELETE /backend/api/naps/:id` - Delete NAP

## 🚀 Performance Optimizations

### Session Pooling
- **25-minute session TTL** with intelligent reuse
- **Instance-aware session management**
- **Automatic cleanup** of expired sessions

### Configuration Caching
- **15-minute cache TTL** for config data
- **Smart config selection** with state tracking
- **ProSBC1 hardcoded mappings** for reliability

### Connection Pooling
- **HTTP keep-alive connections**
- **Request queuing** with rate limiting (5 concurrent per instance)
- **Automatic retry logic** with exponential backoff

### HTML Parsing Optimization
- **3x faster regex-based parsing**
- **DOM fallback** for complex cases
- **Section caching** with 5-minute TTL

## 📊 Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Login/Session | 2000ms | 50ms* | 97% faster |
| Config Selection | 1500ms | 100ms* | 93% faster |
| File Listing | 3000ms | 1200ms | 60% faster |
| Repeat Operations | Same | Cached | 90% faster |

*With caching enabled

## 🔐 Security Features

### Authentication & Authorization
- **JWT token-based authentication**
- **Role-based access control**
- **Session management** with automatic cleanup
- **CSRF protection** for all forms

### Data Protection
- **Encrypted password storage** with bcrypt
- **Secure file upload** validation
- **Input sanitization** and validation
- **Audit logging** for all operations

### Instance Security
- **Instance isolation** - no cross-contamination
- **Secure credential management**
- **Connection encryption** (HTTPS/TLS)
- **Self-signed certificate support**

## 🧪 Testing

### Run Tests
```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend_new
npm test

# Integration tests
npm run test:integration
```

### Test Coverage
- **Unit tests** for all core functions
- **Integration tests** for API endpoints
- **End-to-end tests** for user workflows
- **Performance tests** for optimization validation

## 📚 Documentation

### Core Documentation
- `PROSBC_FILES_INTEGRATION_README.md` - File management features
- `MULTI_INSTANCE_USAGE_GUIDE.md` - Multi-instance support
- `DM_DF_FILE_MANAGEMENT_README.md` - Database schema and validation
- `NAP_OPTIMIZATION_DOCUMENTATION.md` - Performance optimizations

### Deployment Guides
- `UBUNTU_CONFIG_FIX.md` - Ubuntu deployment configuration
- `PROSBC_INSTANCE_PERSISTENCE_FIX.md` - Instance persistence
- `ENHANCED_OPTIMIZATION_FIX_GUIDE.md` - Advanced optimizations

## 🚀 Deployment

### Production Build
```bash
# Build frontend for production
npm run build

# Start backend in production mode
npm start
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual containers
docker build -t prosbc-frontend ./frontend
docker build -t prosbc-backend ./backend_new
```

### Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
PROSBC_URL=https://your-prosbc-server.com
JWT_SECRET=your-production-secret
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=prosbc_automation
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**


## 🆘 Support

### Common Issues
- **Config loading issues**: Check ProSBC instance connectivity
- **File upload failures**: Verify file format and size limits
- **Session timeouts**: Check network connectivity and credentials

### Getting Help
- **Documentation**: Check the documentation files in the project
- **Issues**: Create an issue on GitHub with detailed information
- **Performance**: Use the built-in performance monitoring tools

## 🔄 Version History

### v2.0.0 (Current)
- ✅ Multi-ProSBC instance support
- ✅ Advanced file management with validation
- ✅ Performance optimizations with caching
- ✅ Comprehensive database dashboard
- ✅ Enhanced security and authentication
- ✅ Real-time monitoring and analytics

### v1.0.0
- ✅ Basic ProSBC integration
- ✅ File upload and management
- ✅ NAP creation and management
- ✅ Simple authentication system

---

