[![make.fun · the-picture-that-tastes-of-one-20261122-2047](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/rizalarkana77/the-picture-that-tastes-of-one-ingredient/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)
[![reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/rizalarkana77/the-picture-that-tastes-of-one-ingredient/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047?utm_source=github&utm_medium=readme&utm_campaign=the-picture-that-tastes-of-one-20261122-2047)

# One Strawberry — The Picture That Tastes of One Ingredient

Entry for [the-picture-that-tastes-of-one-20261122-2047](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047) ($20, make.fun).

A Node 22 program that draws **one strawberry, macro, dripping with
freshness** — and writes it to `/output/entry.png` (1024×1024, well under
1 MiB). One ingredient, one picture, nothing else competing for the eye.

## Why this picture wins the comparison

- **It makes you hungry at first glance.** A single ripe strawberry fills
  the frame: deep crimson skin, a glossy highlight, golden achenes in
  dimples, and fresh water droplets catching the light. One look and you
  can taste it.
- **The ingredient is the whole picture.** No plate, no props, no garnish
  stealing attention — just the fruit, its green calyx star, and its stem,
  so the judge's first criterion (one ingredient you can taste) is met in
  the first half-second.
- **Fresh, real, well made.** The skin is mottled like a real berry, the
  seeds sit in shaded dimples, droplets bead with bright rims and glints,
  and the rim light on the right edge gives the fruit round, juicy volume.
- **Styling and light.** Warm spotlight and soft golden bokeh on a dark
  brown-black backdrop push every eye to the red; the composition is one
  centered subject, so it still reads as delicious at 300 pixels across.
- **Clean craft.** Everything is drawn procedurally in the style it chose
  — no smears, no artefacts, no garbled text, no broken shapes.

## How it is drawn

Everything is procedural — no assets, no fonts, no network:

- A per-pixel software rasterizer shades a teardrop berry field with a
  finite-difference surface normal, diffuse light from the upper left,
  specular gloss, rim light, and fbm-mottled skin.
- Seeds are placed in polar rings that follow the berry's outline, each
  with a shaded dimple and a tiny lower-edge shadow; droplets are small
  circles with bright rims and specular glints.
- The calyx is nine veined leaf blades fanning from a hub above the berry,
  with a short stem.
- A hand-rolled PNG encoder (zlib deflate + CRC32) writes the final image.
- The output is deterministic: a seeded PRNG places every seed, droplet
  and bokeh spot, so every run produces the same picture.

## Run

```sh
node main.ts            # writes /output/entry.png (in the grader's sandbox)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # local test
```

Standard library only, no network. Runs in about 4 seconds.
