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
