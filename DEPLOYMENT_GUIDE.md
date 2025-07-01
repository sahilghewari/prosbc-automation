# Deployment Location Guide for prosbc-nap-ui

## Quick Start - Choose Your Deployment Method

### Option 1: Quick Development Setup (Easiest)
**Location**: `/home/yourusername/prosbc-nap-ui`

```bash
# 1. Clone to your home directory
cd ~
git clone https://github.com/yourusername/prosbc-nap-ui.git
cd prosbc-nap-ui

# 2. Install and build
npm install
npm run build

# 3. Copy to web directory
sudo cp -r dist/* /var/www/html/

# 4. Update Nginx config for API proxy
sudo nano /etc/nginx/sites-enabled/default
```

Add this to the Nginx config:
```nginx
location /api/ {
    proxy_pass https://prosbc2tpa2.dipvtel.com:12358/;
    proxy_set_header Host prosbc2tpa2.dipvtel.com;
    proxy_ssl_verify off;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### Option 2: Production Setup (Recommended for live sites)
**Location**: `/opt/prosbc-nap-ui` and `/var/www/prosbc-nap-ui`

```bash
# Run the deployment script in production mode
chmod +x deploy.sh
./deploy.sh production
```

### Option 3: Development with Auto-reload
**Location**: `/home/yourusername/prosbc-nap-ui`

```bash
# Run the deployment script in development mode
chmod +x deploy.sh
./deploy.sh development
```

## Directory Structure After Deployment

### Production Layout:
```
/opt/prosbc-nap-ui/          # Source code and build files
├── src/
├── dist/                    # Built files
├── package.json
├── nginx.conf
└── ...

/var/www/prosbc-nap-ui/      # Web-served files (copied from dist/)
├── index.html
├── assets/
└── ...

/etc/nginx/sites-available/prosbc-nap-ui  # Nginx configuration
```

### Development Layout:
```
/home/yourusername/prosbc-nap-ui/  # Source code and build files
├── src/
├── dist/
└── ...

/var/www/html/               # Web-served files (default Nginx location)
├── index.html
├── assets/
└── ...
```

## Permissions

### Production (Secure):
- Source files: `root:root` or `deploy:deploy` user
- Web files: `www-data:www-data`
- Config files: `root:root`

### Development (Easy):
- Source files: `yourusername:yourusername`
- Web files: `www-data:www-data`

## Quick Commands Reference

```bash
# Check current location
pwd

# See disk space
df -h

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx

# Update application (production)
cd /opt/prosbc-nap-ui
sudo git pull
sudo npm run build
sudo cp -r dist/* /var/www/prosbc-nap-ui/

# Update application (development)
cd ~/prosbc-nap-ui
git pull
npm run build
sudo cp -r dist/* /var/www/html/
```

## Troubleshooting 504 Errors

1. **Test backend connectivity**:
   ```bash
   curl -k -v https://prosbc2tpa2.dipvtel.com:12358
   ```

2. **Check Nginx error logs**:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Verify Nginx config**:
   ```bash
   sudo nginx -t
   ```

4. **Run troubleshooting script**:
   ```bash
   chmod +x troubleshoot.sh
   ./troubleshoot.sh
   ```

## Recommended Approach

**For beginners**: Start with Option 1 (Quick Development Setup)
**For production**: Use Option 2 (Production Setup)
**For active development**: Use Option 3 (Development with Auto-reload)
