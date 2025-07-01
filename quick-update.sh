#!/bin/bash

# Quick Update Script for prosbc-nap-ui
# This script will update your existing deployment

echo "🔄 Quick Update for prosbc-nap-ui..."

# Find where the app is currently deployed
if [ -d "/home/$USER/prosbc-nap-ui" ]; then
    APP_DIR="/home/$USER/prosbc-nap-ui"
    WEB_DIR="/var/www/html"
    echo "✅ Found development deployment in home directory"
elif [ -d "/opt/prosbc-nap-ui" ]; then
    APP_DIR="/opt/prosbc-nap-ui"
    WEB_DIR="/var/www/prosbc-nap-ui"
    echo "✅ Found production deployment in /opt"
else
    echo "❌ No existing deployment found. Run deploy.sh first."
    exit 1
fi

echo "📁 App directory: $APP_DIR"
echo "🌐 Web directory: $WEB_DIR"

# Update code
echo "📥 Pulling latest changes..."
cd $APP_DIR
git pull origin main

# Check if new dependencies were added
if git diff HEAD~1 package.json | grep -q '"dependencies"\|"devDependencies"'; then
    echo "📦 New dependencies detected, running npm install..."
    npm install
fi

# Rebuild
echo "🔨 Building application..."
npm run build

# Update web files
echo "📤 Updating web files..."
if [ "$WEB_DIR" = "/var/www/html" ]; then
    sudo cp -r dist/* $WEB_DIR/
else
    sudo cp -r dist/* $WEB_DIR/
    sudo chown -R www-data:www-data $WEB_DIR
fi

# Restart Nginx
echo "🔄 Restarting Nginx..."
sudo systemctl reload nginx

echo "✅ Update completed!"
echo "🌍 Access your app at: http://$(hostname -I | awk '{print $1}')"
