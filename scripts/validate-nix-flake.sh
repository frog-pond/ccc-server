#!/usr/bin/env bash
# Validation script for Nix flake setup
# This script checks if the Nix flake is properly configured

set -e

echo "=== Nix Flake Validation ==="
echo ""

# Check if nix is installed
if ! command -v nix &> /dev/null; then
    echo "❌ Nix is not installed"
    echo "   Install from: https://nixos.org/download.html"
    exit 1
fi
echo "✓ Nix is installed: $(nix --version)"

# Check if flakes are enabled
if ! nix flake --help &> /dev/null 2>&1; then
    echo "❌ Nix flakes are not enabled"
    echo "   Add to ~/.config/nix/nix.conf or /etc/nix/nix.conf:"
    echo "   experimental-features = nix-command flakes"
    exit 1
fi
echo "✓ Nix flakes are enabled"

# Check flake metadata
echo ""
echo "Checking flake metadata..."
if nix flake metadata . &> /dev/null; then
    echo "✓ Flake metadata is valid"
    nix flake metadata . 2>&1 | head -10
else
    echo "❌ Flake metadata check failed"
    exit 1
fi

# Show available outputs
echo ""
echo "Available flake outputs:"
nix flake show . 2>&1 || true

echo ""
echo "=== Next Steps ==="
echo "1. Enter development shell: nix develop"
echo "2. Build the package: nix build"
echo "3. Run the application: nix run"
echo ""
echo "Note: The first build will fail with a hash mismatch."
echo "Follow the instructions in NIX.md to update npmDepsHash."
