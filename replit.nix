{ pkgs }: {
    deps = [
        pkgs.nodejs
        pkgs.nodePackages.typescript
        pkgs.jellyfin-ffmpeg
        pkgs.git
        pkgs.yarn
    ];
}