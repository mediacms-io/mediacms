#!/bin/bash
# This script builds the video editor package and deploys the frontend assets to the static directory.

# Exit on any error
set -e

echo "Starting build process..."

# Build video editor package
echo "Building video editor package..."
cd frontend-tools/video-editor
yarn build:django
cd ../../

# Run npm build in the frontend container
echo "Building frontend assets..."
docker compose -f docker-compose-dev.yaml exec frontend npm run dist

# Copy static assets to the static directory
echo "Copying static assets..."
cp -r frontend/dist/static/* static/

# Restart the web service
echo "Restarting web service..."
docker compose -f docker-compose-dev.yaml restart web

echo "Build and deployment completed successfully!"