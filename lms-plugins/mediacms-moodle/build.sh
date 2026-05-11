#!/bin/bash

# MediaCMS Moodle Plugin Suite - Build Script
# Creates distributable ZIP package

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}MediaCMS Moodle Plugin Suite Builder${NC}"
echo -e "${GREEN}======================================${NC}"
echo

# Configuration
VERSION="1.0.0"
BUILD_DATE=$(date +%Y%m%d)
PACKAGE_NAME="mediacms-moodle-v${VERSION}"
DIST_DIR="dist"
BUILD_DIR="${DIST_DIR}/${PACKAGE_NAME}"

# Create clean dist directory
echo -e "${YELLOW}→${NC} Cleaning dist directory..."
rm -rf "${DIST_DIR}"
mkdir -p "${BUILD_DIR}"

# Copy filter plugin
echo -e "${YELLOW}→${NC} Copying filter plugin..."
mkdir -p "${BUILD_DIR}/filter"
cp -r filter/mediacms "${BUILD_DIR}/filter/"

# Copy TinyMCE plugin
echo -e "${YELLOW}→${NC} Copying TinyMCE plugin..."
mkdir -p "${BUILD_DIR}/lib/editor/tiny/plugins"
cp -r tiny/mediacms "${BUILD_DIR}/lib/editor/tiny/plugins/"

# Copy documentation
echo -e "${YELLOW}→${NC} Copying documentation..."
cp README.md "${BUILD_DIR}/filter/mediacms/"
cp INSTALL.txt "${BUILD_DIR}/filter/mediacms/"

# Clean up development files
echo -e "${YELLOW}→${NC} Removing development files..."
find "${BUILD_DIR}" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type f -name ".DS_Store" -delete 2>/dev/null || true
find "${BUILD_DIR}" -type f -name "*.log" -delete 2>/dev/null || true
find "${BUILD_DIR}" -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type f -name ".gitignore" -delete 2>/dev/null || true

# Remove AMD source files (keep only built versions)
echo -e "${YELLOW}→${NC} Cleaning AMD source files..."
find "${BUILD_DIR}/lib/editor/tiny/plugins/mediacms/amd" -type f -name "*.js" ! -name "*-lazy.js" ! -path "*/build/*" -delete 2>/dev/null || true

# Create ZIP archive
echo -e "${YELLOW}→${NC} Creating ZIP archive..."
cd "${BUILD_DIR}"
zip -r "../${PACKAGE_NAME}.zip" . -q
cd ../..

# Create checksum
echo -e "${YELLOW}→${NC} Generating checksum..."
cd "${DIST_DIR}"
sha256sum "${PACKAGE_NAME}.zip" > "${PACKAGE_NAME}.zip.sha256"
cd ..

# Display results
ZIP_SIZE=$(du -h "${DIST_DIR}/${PACKAGE_NAME}.zip" | cut -f1)
echo
echo -e "${GREEN}✓ Build complete!${NC}"
echo
echo "Package: ${DIST_DIR}/${PACKAGE_NAME}.zip"
echo "Size: ${ZIP_SIZE}"
echo "Checksum: ${DIST_DIR}/${PACKAGE_NAME}.zip.sha256"
echo
echo -e "${YELLOW}Contents:${NC}"
echo "  - filter/mediacms/ (includes docs)"
echo "  - lib/editor/tiny/plugins/mediacms/"
echo
echo -e "${GREEN}Ready for distribution!${NC}"
echo

# Show checksum
echo -e "${YELLOW}SHA256 Checksum:${NC}"
cat "${DIST_DIR}/${PACKAGE_NAME}.zip.sha256"
echo
