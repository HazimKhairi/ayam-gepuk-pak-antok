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

        send "echo '=== Cleaning dist files ==='\r"
        expect "root@*"

        send "rm -rf backend/dist/\r"
        expect "root@*"

        send "echo '=== Pulling latest code ==='\r"
        expect "root@*"

        send "git stash && git pull origin main\r"
        expect "root@*"

        send "cd backend\r"
        expect "root@*"

        send "echo '=== Regenerating Prisma client ==='\r"
        expect "root@*"

        send "npx prisma generate\r"
        set timeout 120
        expect "root@*"

        send "echo '=== Running migration ==='\r"
        expect "root@*"

        send "DATABASE_URL='mysql://agpa_user:Agpa2026!@localhost:3306/ayamgepuk' npm run update:sets-simple\r"
        set timeout 120
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== Verifying customization count ==='\r"
        expect "root@*"

        send "curl -s http://localhost:3001/api/v1/menu | grep -c '\\\"hasCustomization\\\":true'\r"
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== DONE ==='\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
