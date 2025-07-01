#!/bin/bash

# Deployment script for prosbc-nap-ui on Ubuntu
# Run this script on your Ubuntu server

set -e  # Exit on any error

echo "🚀 Starting deployment of prosbc-nap-ui..."

# Configuration - Choose deployment type
DEPLOYMENT_TYPE="${1:-production}"  # production or development

APP_NAME="prosbc-nap-ui"

if [ "$DEPLOYMENT_TYPE" = "development" ]; then
    APP_DIR="/home/$USER/$APP_NAME"
    WEB_DIR="/var/www/html"  # Use default web directory for development
    NGINX_CONFIG="/etc/nginx/sites-available/default"
    echo -e "${YELLOW}[WARNING]${NC} Development mode: deploying to user directory"
else
    APP_DIR="/opt/$APP_NAME"
    WEB_DIR="/var/www/$APP_NAME"
    NGINX_CONFIG="/etc/nginx/sites-available/$APP_NAME"
    echo -e "${GREEN}[INFO]${NC} Production mode: deploying to system directories"
fi

REPO_URL="https://github.com/yourusername/$APP_NAME.git"  # Update with your actual repo URL

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   print_warning "Running as root. This is not recommended for production."
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update

# Install required packages if not present
print_status "Checking required packages..."
for package in nodejs npm nginx git; do
    if ! command -v $package &> /dev/null; then
        print_status "Installing $package..."
        if [ "$package" = "nodejs" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            sudo apt install -y $package
        fi
    else
        print_status "$package is already installed"
    fi
done

# Create application directory
print_status "Setting up application directory..."
if [ "$DEPLOYMENT_TYPE" = "development" ]; then
    mkdir -p $APP_DIR  # No sudo for user directory
else
    sudo mkdir -p $APP_DIR
    sudo mkdir -p $WEB_DIR
fi

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    print_status "Updating existing repository..."
    cd $APP_DIR
    if [ "$DEPLOYMENT_TYPE" = "development" ]; then
        git pull origin main
    else
        sudo git pull origin main
    fi
else
    print_status "Cloning repository..."
    if [ "$DEPLOYMENT_TYPE" = "development" ]; then
        git clone $REPO_URL $APP_DIR
    else
        sudo git clone $REPO_URL $APP_DIR
    fi
    cd $APP_DIR
fi

# Install dependencies and build
print_status "Installing dependencies..."
if [ "$DEPLOYMENT_TYPE" = "development" ]; then
    npm install
else
    sudo npm install
fi

print_status "Building application..."
if [ "$DEPLOYMENT_TYPE" = "development" ]; then
    npm run build
else
    sudo npm run build
fi

# Copy built files to web directory
print_status "Deploying built files..."
sudo cp -r dist/* $WEB_DIR/
sudo chown -R www-data:www-data $WEB_DIR
sudo chmod -R 755 $WEB_DIR

# Configure Nginx
print_status "Configuring Nginx..."
if [ -f "nginx-production.conf" ]; then
    sudo cp nginx-production.conf $NGINX_CONFIG
    # Update server_name in config (you may want to customize this)
    sudo sed -i 's/your-domain.com/localhost/g' $NGINX_CONFIG
else
    print_warning "nginx-production.conf not found, using default configuration"
fi

# Enable site
if [ ! -L "/etc/nginx/sites-enabled/$APP_NAME" ]; then
    sudo ln -s $NGINX_CONFIG /etc/nginx/sites-enabled/
    print_status "Nginx site enabled"
fi

# Test Nginx configuration
print_status "Testing Nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
    sudo systemctl reload nginx
    print_status "Nginx reloaded"
else
    print_error "Nginx configuration test failed!"
    exit 1
fi

# Start and enable Nginx if not running
sudo systemctl enable nginx
sudo systemctl start nginx

# Setup firewall if ufw is available
if command -v ufw &> /dev/null; then
    print_status "Configuring firewall..."
    sudo ufw allow 22  # SSH
    sudo ufw allow 80  # HTTP
    sudo ufw allow 443 # HTTPS
    print_status "Firewall rules added (not enabled automatically)"
fi

# Display status
print_status "Deployment completed successfully! 🎉"
echo ""
echo "Application Status:"
echo "- App Directory: $APP_DIR"
echo "- Web Directory: $WEB_DIR"
echo "- Nginx Config: $NGINX_CONFIG"
echo ""
echo "Next steps:"
echo "1. Access your app at: http://$(hostname -I | awk '{print $1}')"
echo "2. Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "3. Check app logs: sudo tail -f /var/log/nginx/$APP_NAME.error.log"
echo ""
echo "To troubleshoot API issues:"
echo "- Test API directly: curl -k https://prosbc2tpa2.dipvtel.com:12358"
echo "- Check Nginx error logs for proxy errors"
echo "- Verify SSL certificates on the backend server"
