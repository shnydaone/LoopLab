/**
 * Which files to fetch from each CC0 library. Every rule is a regex tested
 * against the file's path in the source repository.
 *
 * All sources are CC0-1.0 (public domain dedication), verified on GitHub:
 * https://github.com/sfzinstruments
 */

const even = (lo, hi) => Array.from({ length: Math.floor((hi - lo) / 2) + 1 }, (_, i) => lo + i * 2).join('|');
const every3 = (lo, hi) => Array.from({ length: Math.floor((hi - lo) / 3) + 1 }, (_, i) => lo + i * 3).join('|');

export const SOURCES = [
  {
    id: 'virtuosity',
    repo: 'sfzinstruments/virtuosity_drums',
    branch: 'master',
    license: 'CC0-1.0',
    credit: 'Virtuosity Drums by Versilian Studios and Karoryfer Samples (performed by Austin McMahon)',
    include: [
      // Kit pieces: close kick mic + snare mic + overheads (the library's "basic kit" blend)
      /^Samples\/(kickmic|snaremic|oh)\/kick\/\w+_kick_snoff_vl\d+_rr\d+\.flac$/,
      new RegExp(`^Samples\\/(kickmic|snaremic|oh)\\/snare\\/\\w+_snare_center_vl(${every3(3, 36)})\\.flac$`),
      /^Samples\/(kickmic|snaremic|oh)\/snare\/\w+_snare_(rimshot|crossstick)_vl\d+\.flac$/,
      /^Samples\/(kickmic|snaremic|oh)\/hh\/\w+_hh_(closed|open|pedal)_vl\d+(_rr\d+)?\.flac$/,
      /^Samples\/(kickmic|snaremic|oh)\/ride\/\w+_ride_ride_vl\d+(_rr\d+)?\.flac$/,
      /^Samples\/(kickmic|snaremic|oh)\/crash\/\w+_crash_crash_vl\d+_rr[12]\.flac$/,
      new RegExp(`^Samples\\/(kickmic|snaremic|oh)\\/(htom|ltom)\\/\\w+_(htom|ltom)_center_vl(${even(2, 16)})\\.flac$`),
      // Hand percussion (close mic)
      /^Samples\/perc\/close\/\w+\/(BongoH_Hit1|BongoL_Hit1|Claves1_Hit|Cowbell1_Normal)_v\d+_rr[123]_Close\.wav$/,
      /^Samples\/perc\/close\/\w+\/(Conga_22_HitN|Conga_17_HitHM1|Tumba_24_HitN)_\d+_\d+_rr[123]_Close\.wav$/,
      /^Samples\/perc\/close\/shaker\/LShaker_Shake1[DU]_rr[1-4]_Close\.wav$/,
      /^Samples\/perc\/close\/tambourine\/Tamb1_Shake_rr[1-4]_Close\.wav$/,
      /^Samples\/perc\/oh\/timbales\/timb1[34]_vl\d+_rr[12]\.wav$/,
    ],
  },
  {
    id: 'bigrusty',
    repo: 'sfzinstruments/karoryfer.big-rusty-drums',
    branch: 'main',
    license: 'CC0-1.0',
    credit: 'Big Rusty Drums by Karoryfer Samples',
    include: [
      new RegExp(`^Samples\\/kick_24\\/kick\\/(kick|oh|sn)\\/k_vl(${even(2, 14)})_rr[12]\\.flac$`),
      /^Samples\/snare_14\/center\/(top|btm|oh)\/sn_center_vl\d+_rr[12]\.flac$/,
      /^Samples\/snare_14\/rimshot\/(top|btm|oh)\/sn_rims_vl\d+_rr[12]\.flac$/,
      /^Samples\/snare_14\/sidestick\/(top|btm|oh)\/sn_ss_vl\d+_rr[123]\.flac$/,
      /^Samples\/hihat_14\/tc\/(cl|oh)\/ht_tc_vl\d+_rr[12]\.flac$/,
      /^Samples\/hihat_14\/open\/(cl|oh)\/ht_open_vl\d+_rr[12]\.flac$/,
      /^Samples\/hihat_14\/chik\/(cl|oh)\/ht_chik_vl\d+_rr[12]\.flac$/,
      new RegExp(`^Samples\\/ride_22\\/rd\\/(cl|oh)\\/rd_vl(${even(2, 10)})_rr[12]\\.flac$`),
      /^Samples\/crash_17\/cr\/(cl|oh)\/cr_vl\d+_rr[12]\.flac$/,
      new RegExp(`^Samples\\/tom_(14|18)\\/center\\/(cl|oh)\\/t(14|18)_vl(${even(2, 8)})_rr1\\.flac$`),
    ],
  },
  {
    id: 'swagbass',
    repo: 'sfzinstruments/karoryfer.swagbass',
    branch: 'master',
    license: 'CC0-1.0',
    credit: 'Swagbass by Karoryfer Samples (played by D. Smolken)',
    include: [/^notes\/[a-g]b?\d_(p|f|fff)_rr[12]\.wav$/, /\.sfz$/],
  },
  {
    id: 'emilyguitar',
    repo: 'sfzinstruments/karoryfer.emilyguitar',
    branch: 'master',
    license: 'CC0-1.0',
    credit: 'Emilyguitar by Karoryfer Samples (played by D. Smolken)',
    include: [/^notes\/[a-g]b?\d_(p|mf|f)_rr[12]\.wav$/, /^release\/[a-g]b?\d_release_rr\d\.wav$/, /^noises\/muted\d?_rr\d\.wav$/, /\.sfz$/],
  },
  {
    id: 'vsco-brass',
    repo: 'sgossner/VSCO-2-CE',
    branch: 'master',
    license: 'CC0-1.0',
    credit: 'Versilian Studios Chamber Orchestra 2 Community Edition (trumpet, tenor trombone)',
    include: [/^Brass\/Trumpet\/(sus|stac)\/[^/]+\.wav$/, /^Brass\/Tenor Trombone\/(sus|stac)\/[^/]+\.wav$/],
  },
  {
    id: 'vcsl-sax',
    repo: 'sgossner/VCSL',
    branch: 'master',
    license: 'CC0-1.0',
    credit: 'Versilian Community Sample Library (tenor saxophone, played by Brett)',
    include: [
      /^Aerophones\/Reed Aerophones\/Tenor Saxophone\/Staccato\/[^/]+\.wav$/,
      /^Aerophones\/Reed Aerophones\/Tenor Saxophone\/Non-Vibrato\/[^/]+_vl[23]_rr1\.wav$/,
    ],
  },
  {
    id: 'growlybass',
    repo: 'sfzinstruments/karoryfer.growlybass',
    branch: 'master',
    license: 'CC0-1.0',
    credit: 'Growlybass by Karoryfer Samples',
    include: [/^sustain\/[a-g]b?\d_(p|f|ff)_rr[12]\.wav$/, /^staccato\/[a-g]b?\d_staccato_rr[123]\.wav$/, /\.sfz$/],
  },
];
