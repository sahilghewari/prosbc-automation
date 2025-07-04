#!/bin/bash

# Ubuntu Deployment Script for ProSBC NAP Testing Dashboard
# This script sets up the file system database structure

echo "🚀 Starting ProSBC Dashboard Ubuntu Deployment Setup..."

# Configuration
BASE_DIR="/root/prosbc-dashboard"
FILES_DIR="$BASE_DIR/files"
APP_DIR="$BASE_DIR/app"
LOG_FILE="$BASE_DIR/deployment.log"

# Create log file
mkdir -p "$BASE_DIR"
touch "$LOG_FILE"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "🔄 Starting deployment setup..."

# Create directory structure
log "📁 Creating directory structure..."

# Main directories
mkdir -p "$FILES_DIR/df"
mkdir -p "$FILES_DIR/dm"
mkdir -p "$FILES_DIR/routesets"
mkdir -p "$FILES_DIR/backups"
mkdir -p "$FILES_DIR/naps"
mkdir -p "$FILES_DIR/logs"
mkdir -p "$FILES_DIR/metadata"

# Set permissions
log "🔐 Setting directory permissions..."
chmod -R 755 "$FILES_DIR"
chown -R root:root "$FILES_DIR"

# Create initial index files
log "📝 Creating initial index files..."

# File index
cat > "$FILES_DIR/metadata/file_index.json" << EOF
{
  "files": [],
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "version": "1.0.0"
}
EOF

# NAP index
cat > "$FILES_DIR/metadata/nap_index.json" << EOF
{
  "naps": [],
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "version": "1.0.0"
}
EOF

# Create system info file
cat > "$FILES_DIR/system_info.json" << EOF
{
  "deployment_date": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "system": "$(uname -a)",
  "storage_type": "file_system",
  "base_directory": "$FILES_DIR",
  "directories": {
    "df": "$FILES_DIR/df",
    "dm": "$FILES_DIR/dm",
    "routesets": "$FILES_DIR/routesets",
    "backups": "$FILES_DIR/backups",
    "naps": "$FILES_DIR/naps",
    "logs": "$FILES_DIR/logs",
    "metadata": "$FILES_DIR/metadata"
  },
  "version": "1.0.0"
}
EOF

log "📊 Directory structure created successfully:"
log "  Base Directory: $FILES_DIR"
log "  DF Files: $FILES_DIR/df"
log "  DM Files: $FILES_DIR/dm"
log "  Routesets: $FILES_DIR/routesets"
log "  Backups: $FILES_DIR/backups"
log "  NAPs: $FILES_DIR/naps"
log "  Logs: $FILES_DIR/logs"
log "  Metadata: $FILES_DIR/metadata"

# Check Node.js and npm
log "🔍 Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log "✅ Node.js found: $NODE_VERSION"
else
    log "❌ Node.js not found. Installing Node.js..."
    
    # Install Node.js (using NodeSource repository)
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "✅ Node.js installed: $NODE_VERSION"
    else
        log "❌ Failed to install Node.js. Please install manually."
        exit 1
    fi
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log "✅ npm found: $NPM_VERSION"
else
    log "❌ npm not found. Please install npm."
    exit 1
fi

# Install PM2 for process management
log "🔄 Installing PM2 for process management..."
npm install -g pm2

# Create environment file
log "📝 Creating environment configuration..."
cat > "$BASE_DIR/.env" << EOF
NODE_ENV=production
STORAGE_TYPE=filesystem
BASE_STORAGE_DIR=$FILES_DIR
PORT=3000
HOST=0.0.0.0
EOF

# Create PM2 ecosystem file
log "📝 Creating PM2 ecosystem configuration..."
cat > "$BASE_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'prosbc-dashboard',
    script: 'npm',
    args: 'run dev',
    cwd: '$APP_DIR',
    env: {
      NODE_ENV: 'production',
      STORAGE_TYPE: 'filesystem',
      BASE_STORAGE_DIR: '$FILES_DIR',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '$BASE_DIR/logs/err.log',
    out_file: '$BASE_DIR/logs/out.log',
    log_file: '$BASE_DIR/logs/combined.log',
    time: true
  }]
};
EOF

# Create nginx configuration
log "📝 Creating nginx configuration..."
mkdir -p "$BASE_DIR/nginx"
cat > "$BASE_DIR/nginx/prosbc-dashboard.conf" << EOF
server {
    listen 80;
    server_name localhost;

    # Serve static files
    location /files/ {
        alias $FILES_DIR/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
        
        # Security headers
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        
        # CORS headers for API access
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    }

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Create backup script
log "📝 Creating backup script..."
cat > "$BASE_DIR/backup.sh" << 'EOF'
#!/bin/bash

BACKUP_DIR="/root/prosbc-dashboard/backups"
FILES_DIR="/root/prosbc-dashboard/files"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/prosbc_backup_$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" -C "$FILES_DIR" .

# Keep only last 10 backups
cd "$BACKUP_DIR"
ls -t prosbc_backup_*.tar.gz | tail -n +11 | xargs rm -f

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x "$BASE_DIR/backup.sh"

# Create restore script
log "📝 Creating restore script..."
cat > "$BASE_DIR/restore.sh" << 'EOF'
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -la /root/prosbc-dashboard/backups/prosbc_backup_*.tar.gz
    exit 1
fi

BACKUP_FILE="$1"
FILES_DIR="/root/prosbc-dashboard/files"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring from: $BACKUP_FILE"
echo "Target directory: $FILES_DIR"

# Create backup of current state
CURRENT_BACKUP="/root/prosbc-dashboard/backups/pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$CURRENT_BACKUP" -C "$FILES_DIR" .
echo "Current state backed up to: $CURRENT_BACKUP"

# Restore
rm -rf "$FILES_DIR"/*
tar -xzf "$BACKUP_FILE" -C "$FILES_DIR"

echo "Restore completed"
EOF

chmod +x "$BASE_DIR/restore.sh"

# Create status check script
log "📝 Creating status check script..."
cat > "$BASE_DIR/status.sh" << 'EOF'
#!/bin/bash

BASE_DIR="/root/prosbc-dashboard"
FILES_DIR="$BASE_DIR/files"

echo "=== ProSBC Dashboard Status ==="
echo "Date: $(date)"
echo "Base Directory: $BASE_DIR"
echo "Files Directory: $FILES_DIR"
echo ""

echo "=== Directory Structure ==="
for dir in df dm routesets backups naps logs metadata; do
    DIR_PATH="$FILES_DIR/$dir"
    if [ -d "$DIR_PATH" ]; then
        FILE_COUNT=$(find "$DIR_PATH" -type f | wc -l)
        DIR_SIZE=$(du -sh "$DIR_PATH" | cut -f1)
        echo "  $dir: $FILE_COUNT files, $DIR_SIZE"
    else
        echo "  $dir: MISSING"
    fi
done

echo ""
echo "=== Recent Activity ==="
if [ -f "$FILES_DIR/logs/$(date +%Y-%m-%d).json" ]; then
    echo "Today's log entries:"
    jq '.[] | select(.created_at | startswith("'$(date +%Y-%m-%d)'")) | .action + " - " + .details' "$FILES_DIR/logs/$(date +%Y-%m-%d).json" 2>/dev/null | tail -5
else
    echo "No activity logs found for today"
fi

echo ""
echo "=== System Resources ==="
echo "Disk usage: $(df -h "$FILES_DIR" | tail -1 | awk '{print $5 " used"}')"
echo "Memory usage: $(free -h | grep Mem | awk '{print $3 "/" $2}')"

if command -v pm2 &> /dev/null; then
    echo ""
    echo "=== PM2 Status ==="
    pm2 status
fi
EOF

chmod +x "$BASE_DIR/status.sh"

# Set up log rotation
log "📝 Setting up log rotation..."
cat > "/etc/logrotate.d/prosbc-dashboard" << EOF
$BASE_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}

$FILES_DIR/logs/*.json {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

# Create systemd service (alternative to PM2)
log "📝 Creating systemd service..."
cat > "/etc/systemd/system/prosbc-dashboard.service" << EOF
[Unit]
Description=ProSBC Dashboard Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=STORAGE_TYPE=filesystem
Environment=BASE_STORAGE_DIR=$FILES_DIR
Environment=PORT=3000
Environment=HOST=0.0.0.0
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

log "✅ Ubuntu deployment setup completed successfully!"
log ""
log "📋 Next Steps:"
log "1. Copy your application files to: $APP_DIR"
log "2. Install dependencies: cd $APP_DIR && npm install"
log "3. Start with PM2: pm2 start $BASE_DIR/ecosystem.config.js"
log "4. Or start with systemd: systemctl start prosbc-dashboard"
log "5. Enable auto-start: systemctl enable prosbc-dashboard"
log "6. Set up nginx: ln -s $BASE_DIR/nginx/prosbc-dashboard.conf /etc/nginx/sites-available/"
log "7. Enable nginx site: ln -s /etc/nginx/sites-available/prosbc-dashboard.conf /etc/nginx/sites-enabled/"
log "8. Restart nginx: systemctl restart nginx"
log ""
log "📊 Check status anytime with: $BASE_DIR/status.sh"
log "💾 Create backups with: $BASE_DIR/backup.sh"
log "🔄 Restore backups with: $BASE_DIR/restore.sh <backup_file>"
log ""
log "🗂️ File Structure:"
log "  $FILES_DIR/"
log "  ├── df/           (DF files)"
log "  ├── dm/           (DM files)" 
log "  ├── routesets/    (Routeset files)"
log "  ├── backups/      (Backup files)"
log "  ├── naps/         (NAP configurations)"
log "  ├── logs/         (Activity logs)"
log "  └── metadata/     (Index and metadata files)"

echo ""
echo "✅ Setup completed! Check $LOG_FILE for full details."
