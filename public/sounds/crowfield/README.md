# Rainward — Map 3 music

An original, 76.77-second arrangement in D minor at 56 BPM. Bowed cello carries
the melody over sparse acoustic piano, with a quiet breath at the loop point.
The audio is rendered from real instrument recordings, not oscillators or
synthetic instrument presets. Small tuning corrections preserve each recording's
attack, bow texture, overtones and decay. No bowed fragment is stretched into a
synthetic sustained pad.

## Recorded instruments and permission

University of Iowa Musical Instrument Samples, directed by Lawrence Fritts:
https://theremin.music.uiowa.edu/MIS.html

The source states that these recordings may be downloaded and used for any
projects without restrictions. Source and permission checked 2026-09-20.

- Cello: Jean Montes, recorded November 16, 2001, soft bowed notes on the D
  string, in an anechoic chamber with a Neumann KM 84 microphone.
  https://theremin.music.uiowa.edu/MIScello.html
  https://theremin.music.uiowa.edu/sound%20files/MIS/Strings/cello/Cello.arco.pp.sulD.D3B3.aiff
- Piano: the project's existing University of Iowa Steinway Model B recordings
  in `../piano/`, one sample per whole tone, with a maximum one-semitone gap.
  https://theremin.music.uiowa.edu/MISpiano.html

## Regeneration

Download the cello AIFF above, then run the repository's
`scripts/render-crowfield-music.py` with that path. It requires Python with numpy
and macOS `afconvert`. The script includes the score, source regions, tuning,
mixing and encoding steps. No full-length copyrighted music recording is used.
