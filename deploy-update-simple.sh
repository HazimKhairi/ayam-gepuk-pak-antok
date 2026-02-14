#!/usr/bin/expect -f

set timeout 300
set password "Hostinger@2026"

spawn ssh -o StrictHostKeyChecking=no root@72.62.243.23 "cd /var/www/agpa && git stash && git pull origin main && cd backend && npx prisma generate && DATABASE_URL='mysql://agpa_user:Agpa2026!@localhost:3306/ayamgepuk' npm run update:sets-simple && curl -s http://localhost:3001/api/v1/menu | grep -c '\"hasCustomization\":true'"

expect {
    "password:" {
        send "${password}\r"
        exp_continue
    }
    eof
}
