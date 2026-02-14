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

        send "echo '=== Step 1: Regenerate Prisma Client ==='\r"
        expect "root@*"

        send "npx prisma generate\r"
        set timeout 120
        expect "root@*"

        send "echo '=== Step 2: Run Customization Migration ==='\r"
        expect "root@*"

        send "npm run migrate:customization\r"
        set timeout 120
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== Step 3: Verify Results ==='\r"
        expect "root@*"

        send "curl -s http://localhost:3001/api/v1/menu | python3 -c \"import sys, json; data = json.load(sys.stdin); customizable = [i['name'] for i in data if i.get('hasCustomization')]; print(f'Total items: {len(data)}'); print(f'Customizable items: {len(customizable)}'); [print(f'  - {name}') for name in customizable]\"\r"
        expect "root@*"

        send "echo ''\r"
        expect "root@*"

        send "echo '=== MIGRATION COMPLETE ==='\r"
        expect "root@*"

        send "exit\r"
    }
}

expect eof
