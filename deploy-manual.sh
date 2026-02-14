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

        send "echo '=== Step 1: Stash local changes ==='\r"
        expect "root@*"

        send "git stash\r"
        expect "root@*"

        send "echo '=== Step 2: Pull latest code ==='\r"
        expect "root@*"

        send "git pull origin main\r"
        expect "root@*"

        send "echo '=== Step 3: Navigate to backend ==='\r"
        expect "root@*"

        send "cd backend\r"
        expect "root@*"

        send "echo '=== Step 4: Generate Prisma Client ==='\r"
        expect "root@*"

        send "npx prisma generate\r"
        set timeout 120
        expect "root@*"

        send "echo '=== Step 5: Build TypeScript ==='\r"
        expect "root@*"

        send "npm run build\r"
        set timeout 60
        expect "root@*"

        send "echo '=== Step 6: Check PM2 config ==='\r"
        expect "root@*"

        send "cat ecosystem.config.js 2>/dev/null || cat ../ecosystem.config.js 2>/dev/null || echo 'No ecosystem file found'\r"
        expect "root@*"

        send "echo '=== Step 7: Restart PM2 Backend ==='\r"
        expect "root@*"

        send "pm2 restart agpa-backend\r"
        expect "root@*"

        send "echo '=== Step 8: Check Status ==='\r"
        expect "root@*"

        send "pm2 list\r"
        expect "root@*"

        send "echo '=== Step 9: Check logs ==='\r"
        expect "root@*"

        send "pm2 logs agpa-backend --lines 30 --nostream\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
