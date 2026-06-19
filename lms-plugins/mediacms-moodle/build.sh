#!/bin/bash

# MediaCMS Moodle Plugin Suite - Build Script
# Creates two distributable ZIP packages, one per plugin, as required by the
# moodle.org plugins directory (one plugin per ZIP, root folder named after
# the plugin).
#
# Packages:
#   - filter_mediacms-v<VERSION>.zip  (install first)
#   - tiny_mediacms-v<VERSION>.zip    (declares a dependency on filter_mediacms)

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
DIST_DIR="dist"

# Create clean dist directory
echo -e "${YELLOW}→${NC} Cleaning dist directory..."
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# Remove development files from a staged plugin directory
clean_plugin_dir() {
    local dir="$1"
    find "${dir}" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    find "${dir}" -type f -name ".DS_Store" -delete 2>/dev/null || true
    find "${dir}" -type f -name "*.log" -delete 2>/dev/null || true
    find "${dir}" -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
    find "${dir}" -type f -name ".gitignore" -delete 2>/dev/null || true
}

# Stage, zip and checksum a single plugin.
# The ZIP root folder must be the plugin folder name ("mediacms"), as the
# moodle.org plugins directory expects.
build_plugin() {
    local component="$1"   # e.g. filter_mediacms
    local source_dir="$2"  # e.g. filter/mediacms
    local package_name="${component}-v${VERSION}"
    local stage_dir="${DIST_DIR}/${package_name}"

    echo -e "${YELLOW}→${NC} Packaging ${component}..."
    mkdir -p "${stage_dir}"
    cp -r "${source_dir}" "${stage_dir}/mediacms"
    clean_plugin_dir "${stage_dir}/mediacms"

    (cd "${stage_dir}" && zip -r "../${package_name}.zip" mediacms -q)
    (cd "${DIST_DIR}" && sha256sum "${package_name}.zip" > "${package_name}.zip.sha256")
}

# Build filter_mediacms (base plugin - install first)
build_plugin "filter_mediacms" "filter/mediacms"

# Include suite documentation in the filter package
echo -e "${YELLOW}→${NC} Copying documentation into filter_mediacms..."
cp README.md INSTALL.txt "${DIST_DIR}/filter_mediacms-v${VERSION}/mediacms/"
(cd "${DIST_DIR}/filter_mediacms-v${VERSION}" && zip -r "../filter_mediacms-v${VERSION}.zip" mediacms -q)
(cd "${DIST_DIR}" && sha256sum "filter_mediacms-v${VERSION}.zip" > "filter_mediacms-v${VERSION}.zip.sha256")

# Build tiny_mediacms (depends on filter_mediacms)
build_plugin "tiny_mediacms" "tiny/mediacms"
cp INSTALL.txt "${DIST_DIR}/tiny_mediacms-v${VERSION}/mediacms/"
(cd "${DIST_DIR}/tiny_mediacms-v${VERSION}" && zip -r "../tiny_mediacms-v${VERSION}.zip" mediacms -q)
(cd "${DIST_DIR}" && sha256sum "tiny_mediacms-v${VERSION}.zip" > "tiny_mediacms-v${VERSION}.zip.sha256")

# Display results
echo
echo -e "${GREEN}✓ Build complete!${NC}"
echo
for component in filter_mediacms tiny_mediacms; do
    package="${DIST_DIR}/${component}-v${VERSION}.zip"
    echo "Package: ${package} ($(du -h "${package}" | cut -f1))"
done
echo
echo -e "${YELLOW}Install order:${NC}"
echo "  1. filter_mediacms-v${VERSION}.zip"
echo "  2. tiny_mediacms-v${VERSION}.zip (requires filter_mediacms)"
echo
echo -e "${GREEN}Ready for distribution!${NC}"
echo

# Show checksums
echo -e "${YELLOW}SHA256 Checksums:${NC}"
cat "${DIST_DIR}"/*.sha256
echo
