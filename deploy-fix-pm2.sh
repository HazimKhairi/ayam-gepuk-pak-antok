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
        send "cd /var/www/agpa/backend\r"
        expect "root@*"

        send "echo '=== Check dist structure ==='\r"
        expect "root@*"

        send "ls -la dist/\r"
        expect "root@*"

        send "ls -la dist/src/ 2>/dev/null || echo 'No src folder'\r"
        expect "root@*"

        send "echo '=== Delete PM2 process and recreate with correct path ==='\r"
        expect "root@*"

        send "pm2 delete agpa-backend\r"
        expect "root@*"

        send "pm2 start dist/src/server.js --name agpa-backend\r"
        expect "root@*"

        send "pm2 save\r"
        expect "root@*"

        send "echo '=== Check logs ==='\r"
        expect "root@*"

        send "sleep 2\r"
        expect "root@*"

        send "pm2 logs agpa-backend --lines 50 --nostream\r"
        expect "root@*"

        send "echo '=== Final status ==='\r"
        expect "root@*"

        send "pm2 list\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
