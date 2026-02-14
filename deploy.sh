#!/bin/bash
# Deployment script for Ayam Gepuk Pak Antok to VPS

VPS_HOST="72.62.243.23"
VPS_USER="root"
PROJECT_DIR="/var/www/ayam-gepuk-pak-antok"

echo "🚀 Starting deployment to VPS..."

# SSH into VPS and run deployment commands
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    set -e

    echo "📂 Navigating to project directory..."
    cd /var/www/ayam-gepuk-pak-antok 2>/dev/null || cd /home/ayam-gepuk* 2>/dev/null || cd /root/ayam-gepuk* 2>/dev/null || {
        echo "❌ Project directory not found!"
        echo "Available directories:"
        find /var/www /home /root -maxdepth 2 -type d -name "*ayam*" 2>/dev/null
        exit 1
    }

    echo "📥 Pulling latest changes from Git..."
    git pull origin main

    echo "📦 Installing backend dependencies..."
    cd backend
    npm install

    echo "🔨 Building backend..."
    npm run build

    echo "🔄 Restarting PM2 processes..."
    pm2 restart all

    echo "✅ Deployment completed successfully!"
    echo ""
    echo "📊 PM2 Status:"
    pm2 list

ENDSSH

echo ""
echo "🎉 Deployment finished!"
echo "🌐 Visit your website to verify the changes."
