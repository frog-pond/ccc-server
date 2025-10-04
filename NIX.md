# Nix Flake Usage

This project includes a Nix flake for reproducible development and builds.

## Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled

To enable flakes, add this to `~/.config/nix/nix.conf` or `/etc/nix/nix.conf`:
```
experimental-features = nix-command flakes
```

## Development Shell

Enter the development environment with all dependencies:

```bash
nix develop
```

This provides:
- Node.js 20
- npm
- All project dependencies

### Using direnv (optional)

If you have [direnv](https://direnv.net/) installed:

```bash
direnv allow
```

This will automatically load the Nix environment when you enter the project directory.

## Building the Package

Build the project as a Nix derivation:

```bash
nix build
```

The built package will be available in `./result`.

Run the built application:

```bash
./result/bin/ccc-server
```

Or install it to your Nix profile:

```bash
nix profile install
```

## Updating npmDepsHash

When `package-lock.json` changes, you need to update the `npmDepsHash` in `flake.nix`:

1. In `flake.nix`, temporarily set `npmDepsHash = pkgs.lib.fakeSha256;`
2. Run `nix build`
3. The build will fail with an error showing the correct hash
4. Copy the hash from the error message (the part after "got:")
5. Update `npmDepsHash` in `flake.nix` with the correct hash

## Running in Production

Set required environment variables:

```bash
export INSTITUTION=stolaf-college  # or carleton-college
nix run
```

## Flake Outputs

- `devShells.default` - Development shell with Node.js and npm
- `packages.default` - The compiled ccc-server application
- `apps.default` - Application runner for `nix run`

## Validation

To validate the flake setup, run:

```bash
./scripts/validate-nix-flake.sh
```

This will check:
- Nix installation
- Flakes are enabled
- Flake metadata is valid
- Available outputs

## Troubleshooting

### Flakes not enabled

If you get an error about flakes not being recognized, ensure experimental features are enabled:

```bash
mkdir -p ~/.config/nix
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

### Hash mismatch error

When building for the first time, you'll get an error like:

```
error: hash mismatch in fixed-output derivation
  specified: sha256-0000000000000000000000000000000000000000000=
  got:        sha256-AbCd1234567890...
```

Copy the hash after "got:" and update the `npmDepsHash` field in `flake.nix`.

### Node version mismatch

This flake uses Node.js 20 from nixpkgs. If you need a different version, update the `nodejs_20` references in `flake.nix` to match your requirements (e.g., `nodejs_18`, `nodejs_22`).

## Integration with Existing Workflow

The Nix flake is designed to complement, not replace, the existing npm-based workflow. You can:

- Continue using `npm install` and `npm run` commands
- Use Nix for reproducible builds and deployment
- Use Nix devshell for consistent development environments across teams
- Mix both approaches as needed
