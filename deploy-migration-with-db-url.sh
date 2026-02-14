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

        send "echo '=== Run migration with explicit DATABASE_URL ==='\r"
        expect "root@*"

        send "DATABASE_URL='mysql://agpa_user:Agpa2026!@localhost:3306/ayamgepuk' npm run migrate:customization\r"
        set timeout 120
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== Verify menu API ==='\r"
        expect "root@*"

        send "curl -s http://localhost:3001/api/v1/menu | grep -o '\"hasCustomization\":true' | wc -l\r"
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== Sample menu item ==='\r"
        expect "root@*"

        send "curl -s 'http://localhost:3001/api/v1/menu' | head -80\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
