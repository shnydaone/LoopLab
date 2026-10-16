# Bundled sample licences

Every recording in this folder comes from libraries released under
**CC0 1.0 Universal (public domain dedication)**. You may copy, modify and
redistribute them, including commercially, without asking permission. Credit
is not legally required, but we give it gladly.

| LoopLab instrument | Source library | Author | Licence | Repository |
|---|---|---|---|---|
| Roots Kit (`kit-roots/`), hand percussion and timbales (`perc/`) | Virtuosity Drums | Versilian Studios and Karoryfer Samples; drummer Austin McMahon | CC0-1.0 | https://github.com/sfzinstruments/virtuosity_drums |
| Two-Tone Kit (`kit-twotone/`) | Big Rusty Drums | Karoryfer Samples | CC0-1.0 | https://github.com/sfzinstruments/karoryfer.big-rusty-drums |
| Dub Bass (`bass-dub/`) | Swagbass | Karoryfer Samples (D. Smolken) | CC0-1.0 | https://github.com/sfzinstruments/karoryfer.swagbass |
| Round Finger Bass (`bass-round/`) | Growlybass | Karoryfer Samples | CC0-1.0 | https://github.com/sfzinstruments/karoryfer.growlybass |

## What LoopLab changed

`scripts/samples/build.mjs` produced these files from the originals:
- Drum hits: the library's close and overhead microphones were mixed into one stereo file per hit.
- Tails: trimmed with a fade-out.
- High-pass: a gentle filter below 25–30 Hz was applied.
- Format: converted to 16-bit FLAC.
- Selection: only a subset of velocity layers and round robins is included.

To regenerate, run `node scripts/samples/fetch.mjs`, then `node scripts/samples/build.mjs`.

Licences were checked against each repository's LICENSE / GitHub licence metadata
(SPDX `CC0-1.0`) on 2026-10-15.
