# Quick Start: Nix Flake

This is a quick reference for using the Nix flake with ccc-server.

## Prerequisites

1. Install Nix: https://nixos.org/download.html
2. Enable flakes:
   ```bash
   mkdir -p ~/.config/nix
   echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
   ```

## Basic Commands

```bash
# Validate flake setup
./scripts/validate-nix-flake.sh

# Enter development shell
nix develop

# Build the package
nix build

# Run the application
INSTITUTION=stolaf-college nix run

# Show available outputs
nix flake show
```

## First-Time Setup

The first build will fail with a hash mismatch. This is expected:

```bash
nix build
# Error: hash mismatch
#   specified: sha256-0000000000000000000000000000000000000000000=
#   got:        sha256-AbCd1234567890...
```

Copy the hash after "got:" and update it in `flake.nix`:

```nix
npmDepsHash = "sha256-AbCd1234567890...";  # Update this line
```

Then rebuild:

```bash
nix build
./result/bin/ccc-server
```

## Development Workflow

```bash
# Option 1: Use direnv (auto-loads environment)
direnv allow
# Now you're in the dev environment automatically

# Option 2: Manual shell
nix develop
npm install
npm run build
npm run watch
```

## Integration with Docker

The Nix build can complement your existing Docker workflow:

- Use Docker for production deployments
- Use Nix for reproducible local development
- Both can coexist in the same repository

See [NIX.md](./NIX.md) for complete documentation.
