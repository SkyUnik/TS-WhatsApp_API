{ pkgs }: {
    deps = [
        pkgs.yarn
        pkgs.nodejs
        pkgs.nodePackages.npm
        pkgs.nodePackages.typescript
        pkgs.nodePackages.pm2
    ];
}