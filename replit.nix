{ pkgs }: {
    deps = [
        pkgs.nodejs
        pkgs.imagemagick
        pkgs.nodePackages.typescript
        pkgs.jellyfin-ffmpeg
        pkgs.git
        pkgs.yarn
    ];
}