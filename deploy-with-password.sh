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

        send "pwd\r"
        expect "root@*"

        send "echo '📥 Pulling latest changes...'\r"
        expect "root@*"

        send "git stash\r"
        expect "root@*"

        send "git pull origin main\r"
        expect "root@*"

        send "echo '📦 Installing backend dependencies...'\r"
        expect "root@*"

        send "cd backend\r"
        expect "root@*"

        send "npm install\r"
        set timeout 120
        expect "root@*"

        send "echo '🔨 Building backend...'\r"
        expect "root@*"

        send "npm run build\r"
        set timeout 60
        expect "root@*"

        send "echo '🔄 Restarting PM2...'\r"
        expect "root@*"

        send "pm2 restart agpa-backend\r"
        expect "root@*"

        send "pm2 list\r"
        expect "root@*"

        send "pm2 logs agpa-backend --lines 20 --nostream\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
