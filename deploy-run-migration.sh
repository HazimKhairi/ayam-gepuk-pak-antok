#!/usr/bin/expect -f

set timeout 300
set password "Hostinger@2026"
set vps_host "72.62.243.23"
set vps_user "root"

spawn ssh -o StrictHostKeyChecking=no ${vps_user}@${vps_host}
expect {
    "password:" {
        send "${password}\r"
        exp_continue
    }
    "root@*" {
        send "cd /var/www/agpa\r"
        expect "root@*"

        send "echo '=== Step 1: Pull latest code ==='\r"
        expect "root@*"

        send "git stash\r"
        expect "root@*"

        send "git pull origin main\r"
        expect "root@*"

        send "echo '=== Step 2: Navigate to backend ==='\r"
        expect "root@*"

        send "cd backend\r"
        expect "root@*"

        send "echo '=== Step 3: Run migration script ==='\r"
        expect "root@*"

        send "npm run migrate:customization\r"
        set timeout 120
        expect "root@*"

        send "echo '=== Step 4: Verify menu items ==='\r"
        expect "root@*"

        send "curl -s http://localhost:3001/api/v1/menu | grep -c '\"hasCustomization\":true'\r"
        expect "root@*"

        send "echo '=== Step 5: Test health ==='\r"
        expect "root@*"

        send "curl -s http://localhost:3001/health\r"
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== DEPLOYMENT COMPLETE ==='\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
