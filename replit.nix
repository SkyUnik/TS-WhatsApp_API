{ pkgs }: {
    deps = [
        pkgs.nodePackages.typescript
        pkgs.jellyfin-ffmpeg
        pkgs.git
    ];
}