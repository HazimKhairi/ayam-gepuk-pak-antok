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

        send "echo '=== Current DATABASE_URL ==='\r"
        expect "root@*"

        send "grep DATABASE_URL .env\r"
        expect "root@*"

        send "echo '=== Updating .env with correct credentials ==='\r"
        expect "root@*"

        send "sed -i 's|DATABASE_URL=.*|DATABASE_URL=\"mysql://agpa_user:Agpa2026!@localhost:3306/ayamgepuk\"|' .env\r"
        expect "root@*"

        send "echo '=== Verify update ==='\r"
        expect "root@*"

        send "grep DATABASE_URL .env\r"
        expect "root@*"

        send "echo '=== Restart PM2 ==='\r"
        expect "root@*"

        send "pm2 restart agpa-backend\r"
        expect "root@*"

        send "echo '=== Wait and check logs ==='\r"
        expect "root@*"

        send "sleep 3\r"
        expect "root@*"

        send "pm2 logs agpa-backend --lines 30 --nostream\r"
        expect "root@*"

        send "echo '=== Test health endpoint from VPS ==='\r"
        expect "root@*"

        send "curl -s http://localhost:3001/health | head -20\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
