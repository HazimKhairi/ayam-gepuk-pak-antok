#!/bin/bash

# Ayam Gepuk Pak Antok - Deployment Script
# Usage: ./deploy.sh [backend|frontend|all]

set -e

DEPLOY_TARGET=${1:-all}

echo "🚀 Starting deployment for: $DEPLOY_TARGET"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Deploy Backend
deploy_backend() {
    print_status "Deploying backend..."

    cd backend

    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install --production=false

    # Generate Prisma client
    print_status "Generating Prisma client..."
    npm run db:generate

    # Run migrations
    print_status "Running database migrations..."
    npm run db:migrate

    # Build TypeScript
    print_status "Building backend..."
    npm run build

    # Restart PM2
    print_status "Restarting backend service..."
    pm2 restart agpa-backend || pm2 start dist/src/server.js --name agpa-backend

    cd ..
    print_status "Backend deployment complete!"
}

# Deploy Frontend
deploy_frontend() {
    print_status "Deploying frontend..."

    cd frontend

    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install

    # Build Next.js
    print_status "Building frontend..."
    npm run build

    # Restart PM2
    print_status "Restarting frontend service..."
    pm2 restart agpa-frontend || pm2 start "serve out -l 3000" --name agpa-frontend

    cd ..
    print_status "Frontend deployment complete!"
}

# Main deployment logic
case $DEPLOY_TARGET in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        deploy_backend
        deploy_frontend
        ;;
    *)
        print_error "Invalid target: $DEPLOY_TARGET"
        echo "Usage: ./deploy.sh [backend|frontend|all]"
        exit 1
        ;;
esac

# Show PM2 status
echo ""
print_status "Current PM2 status:"
pm2 status

echo ""
print_status "🎉 Deployment completed successfully!"
print_warning "Don't forget to check the logs: pm2 logs"
