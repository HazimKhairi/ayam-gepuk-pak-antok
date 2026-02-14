#!/usr/bin/expect -f

set timeout 60
set password "Hostinger@2026"

spawn ssh -o StrictHostKeyChecking=no root@72.62.243.23 "curl -s http://localhost:3001/api/v1/menu | grep -o '\"name\":\"[^\"]*\",\"description\":[^}]*\"hasCustomization\":true' | grep -o '\"name\":\"[^\"]*\"' | sed 's/\"name\":\"//' | sed 's/\"//' && echo ''"

expect {
    "password:" {
        send "${password}\r"
        exp_continue
    }
    eof
}
