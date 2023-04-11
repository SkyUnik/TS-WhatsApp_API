{ pkgs }: {
    deps = [
        pkgs.yarn
        pkgs.nodejs
        pkgs.jellyfin-ffmpeg
        pkgs.nodePackages.npm
        pkgs.nodePackages.typescript
        pkgs.nodePackages.pm2
    ];
}