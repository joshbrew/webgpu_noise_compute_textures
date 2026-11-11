// Palette stops from WebGPU Realtime Clouds' Planet Studio (MIT).
const palettes = [
  [
    "Utahish",
    "000033 000097 000097 ffb266 003300 75b582 994c00 cc6600 663300 994c00 cc6600 ff8000 ffb266 993300 ea9966 cc6633 003300 39b532 993300 663300 331900 994c00 cc6600 146338 75b582 146338 ff8000 e1e1e1",
  ],
  [
    "Volcanic",
    "000000 190c00 331900 4c2600 663300 804000 995933 b32200 8b0000 661111 802d24 994600 b35900 cc9900 bb9b55 b3a970 ccc0a0 b39966 cccca4 b3a077 998e7e 6c5f6c 595959 696969 778899 708090 a9a9a9",
  ],
  [
    "Desert",
    "4d3319 664c33 80664c 997f66 b39980 ccb399 cccc99 cccc66 cccc33 ccb300 cc8033 cc6600 cc6600 ff8000 ffb266 663300 664d33 996600 b38000 ccb366 b3b399 999980 808066 66664c 4c4c33 333319 ccb399",
  ],
  [
    "Forest",
    "000019 003300 004d00 006600 008000 198019 338033 4c994c 66b366 80cc80 99cc66 b3cc33 cccc00 ccb300 cc9933 cc8000 004d00 006600 008000 663300 664d33 996600 b38000 ccb366 b3b399 999980 808066 66664c 4c4c33 e1e1e1",
  ],
  [
    "Oceanic",
    "000019 000033 00004c 000066 000080 194d80 3380b3 4c99cc 66b3e5 72cccc 99ccff 59cccc 5699b3 3683b5 2d93c9 23415a 32557f 58626f 636d7f 708090 778899 696969 595959 4d4d4d 424242 373737",
  ],
  [
    "Ice",
    "000033 000066 000099 0000cc 0000ff 3399ff 66ccff 99ccff cce5ff e5ffff ffffff e0ffff add8e6 87ceeb 87cefa 4682b4 6495ed b0c4de c7ceea fffafa f0f8ff f0ffff f0fff0 f5fffa fff8dc ffefd5 e1e1e1",
  ],
  [
    "Ice2",
    "000019 000033 00004c 000066 000080 194d80 3380b3 4c99cc 66b3e5 72cccc 99ccff 59cccc 5699b3 3683b5 2d93c9 23415a 32557f 58626f 636d7f 808080 78879b 649696 64877d 7b9b9b ccd2b4 c8c3aa e1e1e1",
  ],
  [
    "Mars Dawn",
    "120a0e 341612 582a18 7e3a1c a04c24 bf6434 d2824c dea270 e8be94 f3d7ba fcf0dc d0ae84 aa7852 885237 6c3e2d 523028 42583e 5c764c 847858 e0e0e0",
  ],
  [
    "Badlands",
    "1c120c 3a2012 5c3016 82441e a45c2c c27640 d89256 e4ac70 ecc28a f4d6aa 785c36 5c784c 8a9860 bcaa6e d2bc84 a56e4c 744a34 56362a 462e24 e1e1e1",
  ],
  [
    "Jungle",
    "06100c 0a2012 0e3418 164e22 206c2e 308840 46a052 5eb662 7ec46e 9cce7a bcc478 786e40 5c5230 4a4228 3a3222 2c281c 28606c 3e8a8e 74b0aa e4ece4",
  ],
  [
    "Toxic",
    "080e08 121c0e 1c2e14 2e4618 46621a 5e801e 78a022 96bc2a b6d238 d6e452 c6bc60 a48c44 806432 624a2a 4c3626 3a2a24 265a52 328476 58c4a8 e4f8ce",
  ],
  [
    "Lavender Dusk",
    "0c0a1c 181230 2a1c48 3e2a62 583a7e 764e9a 9668b2 b684c4 ce9ccc e2b8d2 f0d0d8 ceb0ac b08e88 8c6a66 6c5052 503e44 4e7286 709cb0 a4cad4 f4f4f6",
  ],
  [
    "Amberstone",
    "22140e 3a2216 58361e 784e2a 986636 b68042 cc9a52 deb468 eaca82 f2dca0 e4ccb0 d2ba9e bea48c a8907c 927c6c 7c6c5e 685a50 967462 bc947a f5ece0",
  ],
  [
    "Copper Oxide",
    "0a1416 122628 1a383a 224a4c 2c5e60 387476 488a8a 60a29c 82b09c a4a47e bc9260 cc7c4a ba663a a05230 844228 6a3624 542c20 74583a aa906c e8e2d4",
  ],
  [
    "Moon Dust",
    "08080a 121216 1c1c22 28282e 36363c 46464e 585860 6c6c74 808088 94949a a8a8ac b8b8ba c4c4c4 b0a294 988a7e 80746c 6c625c 5e5854 7e848a e8e8ec",
  ],
  [
    "Coral Sea",
    "000c1e 001a34 002c4e 00426e 005e8e 147caa 369cc0 5cb8cc 82cece a6dcc4 c4d6a8 dcc48e ecb07e f49a78 ee8278 de6c76 ba6078 926e8a 708aa4 f0f6f8",
  ],
];

const catalog = new Map();
const lunarPresets = new Set(["moon-dust", "lunar-highlands", "basalt-mare", "pluto", "ceres", "ceres-crater-fields"]);
const terrainStyles = {
  lakeshore: "alpine",
  ice: "alpine",
  ice2: "alpine",
  forest: "alpine",
  jungle: "alpine",
  utahish: "mesa",
  badlands: "mesa",
  desert: "mesa",
  "copper-oxide": "mesa",
  "verdigris-sea": "mesa",
  volcanic: "volcanic",
  "amethyst-tide": "volcanic",
  "mars-dawn": "volcanic",
  toxic: "volcanic",
  io: "volcanic",
};
const vegetatedCover = {
  lakeshore: .87, forest: .98, jungle: 1, oceanic: .36,
  utahish: .32, "coral-sea": .40, toxic: .52, "lavender-dusk": .26,
};
function add(name, colors, seedOffset, { id = name.toLowerCase().replaceAll(" ", "-"), ocean, dry = false,
  material = 0, craterDetail = 0, cryoGlaciers = false } = {}) {
  const stops = colors.split(" ").map((hex) => parseInt(hex, 16));
  catalog.set(id, {
    id,
    name,
    stops,
    seedOffset,
    geology: terrainStyles[id] ?? "mixed",
    vegetation: vegetatedCover[id] ?? .045,
    lunar: lunarPresets.has(id),
    ocean,
    dry,
    material,
    craterDetail,
    cryoGlaciers,
  });
}
add(
  "Lakeshore",
  "183b5b 285c7e 4b8b95 b8a979 59794e 789660 86996a 8e8976 bdbaa8 e1e7e9",
  0,
);
palettes.forEach((p, i) => add(...p, 1013 * (i + 1), p[0] === "Amberstone" ? { id: "gas-giant" } : undefined));

add(
  "Verdigris Sea",
  "173f40 448e7a d8c58f d7a873 b47851 a85a42 784438 5a4541 6c7774 b3bc9f f3e8ce",
  1013 * (palettes.length + 1),
  { ocean: {
    coverage: .86,
    shallow: [.06, .30, .19, .006],
    deep: [.006, .064, .065, .0018],
    sediment: [.66, .51, .29],
    outcrop: [.33, .12, .060],
    shoal: [.16, .45, .29, 440],
  } },
);
add(
  "Amethyst Tide",
  "241943 524873 d2a9c5 b888b6 885da2 674785 493855 404059 78758d b3a7c4 e1d7ed",
  1013 * (palettes.length + 2),
  { ocean: {
    coverage: .93,
    shallow: [.23, .12, .36, .008],
    deep: [.043, .014, .097, .0019],
    sediment: [.52, .37, .53],
    outcrop: [.095, .063, .13],
    shoal: [.42, .23, .47, 320],
  } },
);

add(
  "Lunar Highlands",
  "24272e 41454c 565b64 6c717a 80868e 999da3 aeb3b7 c3c6c7 d4d6d5 e3e5e2",
  1013 * (palettes.length + 3),
);
add(
  "Basalt Mare",
  "17161a 28272d 3a373c 504847 655953 74645b 8c786b a39181 b8a898 d1c1af",
  1013 * (palettes.length + 4),
);
add(
  "Titan",
  "192d31 304549 796746 9c8252 b7a274 ccb688 e0cca5 bca783 9c9f86 b8bda3 d6d3bb",
  1013 * (palettes.length + 5),
  { material: 1, ocean: {
    name: "Methane seas",
    coverage: .095,
    shallow: [.027, .073, .076, .014],
    deep: [.006, .016, .026, .005],
    sediment: [.38, .29, .16],
    outcrop: [.17, .13, .087],
    shoal: [.049, .10, .089, 160],
  } },
);
add(
  "Io",
  "302529 614033 a7603c d08536 e1ad47 e9c461 ead178 dcca98 b5a6bb c8bfd6 efe3cc",
  1013 * (palettes.length + 6),
  { material: 2, dry: true },
);
add(
  "Pluto",
  "431e24 793227 a04d35 ca6845 ce8667 dba990 b9c9ce d8e1df e9e7d9 f7f4e7",
  1013 * (palettes.length + 7),
  { material: 3, craterDetail: .62, cryoGlaciers: true },
);
const ceresColors = "211824 302c40 2c405d 47618a 65515f 8e5144 a76953 b78770 adaba7";
add(
  "Ceres",
  ceresColors,
  1013 * (palettes.length + 8),
  { material: 4, craterDetail: 1.25 },
);
add(
  "Ceres Crater Fields",
  ceresColors,
  1013 * (palettes.length + 8),
  { material: 4, craterDetail: 2 },
);

export const PlanetPresets = Object.freeze(
  Array.from(catalog.values(), ({ id, name, ocean }) =>
    Object.freeze({ id, name, wet: ocean !== undefined }),
  ),
);

export function getPreset(id = "lakeshore") {
  const preset = catalog.get(id);
  if (!preset) throw new RangeError(`Unknown planet preset: ${id}`);
  return preset;
}
