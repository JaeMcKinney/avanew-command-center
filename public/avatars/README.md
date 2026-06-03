# Avatar card thumbnails

Drop a JPG, PNG, or WebP image in this folder for each avatar card. Filenames the demo page expects:

| Card | Thumbnail file | Notes |
|---|---|---|
| Victoria | `victoria.jpg` (or `.png` / `.webp`) | Dermatology concierge |
| Connie | `connie.jpg` | CONQUER navigator |
| Avatar 3 | `avatar-3.jpg` | Placeholder slot |

**Recommended:** 16:9 aspect ratio, ~1280×720, < 250 KB. A still frame of the avatar's face works best.

To change a thumbnail, just replace the file and commit. The demo page looks them up by name from `/avatars/<name>.jpg`.

To use a different filename, update the `data-tavus-thumb` attribute on the matching `.embed-video` element in `demo.html`.
