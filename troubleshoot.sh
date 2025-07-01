#!/bin/bash

# Troubleshooting script for 504 Gateway Timeout errors
# Run this on your Ubuntu server to diagnose proxy issues

echo "🔍 Diagnosing 504 Gateway Timeout Issues..."
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "\n${BLUE}[TEST]${NC} $1"
}

print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC} $2"
    else
        echo -e "${RED}✗ FAIL${NC} $2"
    fi
}

# Test 1: Check if backend API is reachable
print_test "Testing backend API connectivity..."
if curl -k -s --connect-timeout 10 https://prosbc2tpa2.dipvtel.com:12358 > /dev/null; then
    print_result 0 "Backend API is reachable"
else
    print_result 1 "Backend API is not reachable or timing out"
    echo "  Possible issues:"
    echo "  - Network connectivity problems"
    echo "  - Backend server is down"
    echo "  - Firewall blocking outbound connections"
    echo "  - DNS resolution issues"
fi

# Test 2: Check DNS resolution
print_test "Testing DNS resolution..."
if nslookup prosbc2tpa2.dipvtel.com > /dev/null 2>&1; then
    print_result 0 "DNS resolution works"
    echo "  IP Address: $(nslookup prosbc2tpa2.dipvtel.com | grep 'Address:' | tail -1 | awk '{print $2}')"
else
    print_result 1 "DNS resolution failed"
fi

# Test 3: Check SSL certificate
print_test "Testing SSL certificate..."
if echo | openssl s_client -connect prosbc2tpa2.dipvtel.com:12358 -servername prosbc2tpa2.dipvtel.com 2>/dev/null | grep -q "Verify return code: 0"; then
    print_result 0 "SSL certificate is valid"
else
    print_result 1 "SSL certificate issues detected"
    echo "  This might cause proxy issues. Consider setting proxy_ssl_verify off;"
fi

# Test 4: Check Nginx status
print_test "Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    print_result 0 "Nginx is running"
else
    print_result 1 "Nginx is not running"
fi

# Test 5: Check Nginx configuration
print_test "Testing Nginx configuration syntax..."
if nginx -t &> /dev/null; then
    print_result 0 "Nginx configuration is valid"
else
    print_result 1 "Nginx configuration has errors"
    echo "  Run 'sudo nginx -t' for details"
fi

# Test 6: Check for proxy timeout settings
print_test "Checking proxy timeout settings in Nginx config..."
if grep -q "proxy_read_timeout" /etc/nginx/sites-enabled/* 2>/dev/null; then
    print_result 0 "Proxy timeout settings found"
    echo "  Current settings:"
    grep -r "proxy_.*_timeout" /etc/nginx/sites-enabled/ 2>/dev/null || echo "  No timeout settings found"
else
    print_result 1 "No proxy timeout settings found"
    echo "  Consider adding timeout settings to your Nginx configuration"
fi

# Test 7: Check recent error logs
print_test "Checking recent Nginx error logs..."
echo "Last 10 error log entries:"
tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"

# Test 8: Test direct API call with timeout
print_test "Testing API with extended timeout..."
if timeout 30 curl -k -s https://prosbc2tpa2.dipvtel.com:12358 > /dev/null; then
    print_result 0 "API responds within 30 seconds"
else
    print_result 1 "API does not respond within 30 seconds"
    echo "  This suggests the backend is slow or unresponsive"
fi

# Test 9: Check system resources
print_test "Checking system resources..."
echo "Memory usage:"
free -h
echo -e "\nDisk usage:"
df -h
echo -e "\nLoad average:"
uptime

# Recommendations
echo -e "\n${YELLOW}💡 RECOMMENDATIONS:${NC}"
echo "1. If backend API is slow, increase proxy timeouts in Nginx:"
echo "   proxy_connect_timeout 60s;"
echo "   proxy_send_timeout 60s;"
echo "   proxy_read_timeout 60s;"
echo ""
echo "2. If SSL issues, add to Nginx config:"
echo "   proxy_ssl_verify off;"
echo "   proxy_ssl_session_reuse off;"
echo ""
echo "3. Test API directly from your server:"
echo "   curl -k -v https://prosbc2tpa2.dipvtel.com:12358"
echo ""
echo "4. Monitor real-time logs:"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""
echo "5. If issues persist, check with backend team about:"
echo "   - API response times"
echo "   - Server load"
echo "   - SSL certificate validity"
