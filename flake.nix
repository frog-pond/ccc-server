{
  description = "ccc-server - cautious-computing-context: backend node caching server/proxy";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
  };

  outputs = inputs @ {
    flake-parts,
    systems,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = import systems;

      perSystem = {
        config,
        self',
        inputs',
        pkgs,
        system,
        ...
      }: {
        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            nodePackages.npm
          ];

          shellHook = ''
            echo "ccc-server development environment"
            echo "Node.js version: $(node --version)"
            echo "npm version: $(npm --version)"
            echo ""
            echo "Available commands:"
            echo "  npm install    - Install dependencies"
            echo "  npm run build  - Build the project"
            echo "  npm run test   - Run tests"
            echo "  npm run watch  - Watch mode (auto-recompile & restart)"
            echo ""
          '';
        };

        # Package derivation
        packages.default = pkgs.buildNpmPackage {
          pname = "ccc-server";
          version = "0.2.0";

          src = pkgs.lib.cleanSourceWith {
            src = ./.;
            filter = path: type:
              let
                baseName = baseNameOf path;
              in
              # Exclude common non-source files
              ! (pkgs.lib.hasSuffix ".log" baseName
                || baseName == "node_modules"
                || baseName == "dist"
                || baseName == ".git"
                || baseName == "result"
                || baseName == ".direnv"
                || baseName == ".tsbuildinfo"
                || baseName == ".eslintcache");
          };

          # To update this hash:
          # 1. Set this to pkgs.lib.fakeSha256
          # 2. Run: nix build
          # 3. Copy the "got: sha256-..." hash from the error message
          # 4. Replace pkgs.lib.fakeSha256 with that hash
          npmDepsHash = "sha256-0000000000000000000000000000000000000000000=";

          buildPhase = ''
            runHook preBuild
            npm run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/lib/ccc-server
            cp -r dist $out/lib/ccc-server/
            cp -r node_modules $out/lib/ccc-server/
            cp package.json $out/lib/ccc-server/

            mkdir -p $out/bin
            cat > $out/bin/ccc-server <<EOF
            #!${pkgs.bash}/bin/bash
            exec ${pkgs.nodejs_20}/bin/node $out/lib/ccc-server/dist/source/ccc-server/index.js "\$@"
            EOF
            chmod +x $out/bin/ccc-server

            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Backend Node caching server/proxy";
            license = licenses.agpl3Only;
            maintainers = [];
            platforms = platforms.all;
          };
        };

        # App for running with 'nix run'
        apps.default = {
          type = "app";
          program = "${self'.packages.default}/bin/ccc-server";
        };
      };
    };
}
