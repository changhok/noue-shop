// Generates the placeholder product illustrations used by the sample catalogue.
// Run with:  node scripts/make-samples.mjs
// Output:    public/img/samples/<name>.svg  (4:5 tile with background)
//            public/img/charms/<name>.svg   (transparent, used by the home hero)
// Real product photos uploaded in the admin replace these; the files can then be deleted.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img');
const TILE = '#F1F1EF';
const BRASS = '#B99C5F';

// A shape is [svgElementWithoutFill, fillColour, textured?]
const p = (d) => `<path d="${d}"/>`;
const c = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const e = (cx, cy, rx, ry, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;

function star(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" stroke-linejoin="round"/>`;
}

const motifs = {
  cherry: {
    cord: 178,
    lines: [
      ['M200 178 C 190 220, 170 250, 160 284', '#4F6B3A', 6],
      ['M200 178 C 215 225, 235 255, 246 292', '#4F6B3A', 6],
    ],
    shapes: [
      [p('M202 184 C 232 160, 272 172, 282 202 C 250 216, 218 208, 202 184Z'), '#5C7C44', true],
      [c(158, 322, 46), '#B3262E', true],
      [c(248, 330, 46), '#A51F2A', true],
    ],
  },
  daisy: {
    cord: 240,
    shapes: [
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        const cx = 200 + Math.sin(a) * 56;
        const cy = 306 - Math.cos(a) * 56;
        return [e(cx.toFixed(1), cy.toFixed(1), 25, 42, i * 45).replace('/>', ' stroke="#DDD5C2" stroke-width="2"/>'), '#FBF9F3', true];
      }),
      [c(200, 306, 34), '#E0AE3A', true],
    ],
  },
  strawberry: {
    cord: 226,
    shapes: [
      [p('M200 236 C 256 226, 286 266, 271 316 C 259 356, 226 386, 200 396 C 174 386, 141 356, 129 316 C 114 266, 144 226, 200 236Z'), '#C53A3A', true],
      [p('M200 222 L 172 214 L 180 242 L 148 250 L 184 264 L 200 250 L 216 264 L 252 250 L 220 242 L 228 214 Z'), '#55793F', true],
      ...[[170, 290], [205, 282], [236, 296], [186, 326], [222, 330], [202, 362]].map(([x, y]) => [
        e(x, y, 3.4, 6, 12), '#F6E7C8', false,
      ]),
    ],
  },
  tulip: {
    cord: 232,
    lines: [['M200 338 L 200 420', '#5C7C44', 8]],
    shapes: [
      [p('M200 404 C 170 400, 150 380, 146 356 C 172 360, 192 378, 200 404Z'), '#5C7C44', true],
      [p('M200 404 C 230 400, 250 380, 254 356 C 228 360, 208 378, 200 404Z'), '#6B8C50', true],
      [p('M148 246 C 146 316, 172 344, 200 344 C 228 344, 254 316, 252 246 L 226 276 L 200 238 L 174 276 Z'), '#E594AA', true],
    ],
  },
  lemon: {
    cord: 214,
    shapes: [
      [p('M204 226 C 232 204, 268 212, 280 238 C 252 252, 222 248, 204 226Z'), '#5C7C44', true],
      [p('M200 226 C 246 226, 268 268, 268 308 C 268 352, 240 384, 208 390 C 204 400, 196 400, 192 390 C 160 384, 132 352, 132 308 C 132 268, 154 226, 200 226Z'), '#EBC944', true],
    ],
  },
  mushroom: {
    cord: 204,
    shapes: [
      [`<rect x="170" y="290" width="60" height="100" rx="24"/>`, '#F3EBDD', true],
      [p('M116 304 C 116 238, 162 204, 200 204 C 238 204, 284 238, 284 304 Z'), '#BC3A2C', true],
      [c(160, 262, 11), '#FBF9F3', false],
      [c(204, 238, 9), '#FBF9F3', false],
      [c(244, 268, 12), '#FBF9F3', false],
      [c(200, 284, 7), '#FBF9F3', false],
    ],
  },
  clover: {
    cord: 222,
    lines: [['M200 320 C 204 352, 212 378, 226 398', '#3F7445', 8]],
    shapes: [
      [c(200, 302, 30), '#458049', false],
      [c(166, 270, 40), '#4E8A52', true],
      [c(234, 270, 40), '#4E8A52', true],
      [c(166, 334, 40), '#458049', true],
      [c(234, 334, 40), '#458049', true],
    ],
  },
  heart: {
    cord: 256,
    shapes: [
      [p('M200 384 C 118 328, 108 270, 138 244 C 164 222, 194 238, 200 264 C 206 238, 236 222, 262 244 C 292 270, 282 328, 200 384Z'), '#C4455A', true],
    ],
  },
  star: {
    cord: 222,
    shapes: [[star(200, 308, 78, 40).replace('/>', ' stroke="#D9A93A" stroke-width="16"/>'), '#D9A93A', true]],
  },
  fish: {
    cord: 262,
    shapes: [
      [p('M262 304 L 306 266 L 300 304 L 306 342 Z'), '#3F6E94', true],
      [e(198, 304, 74, 44), '#4C7FA8', true],
      [p('M186 262 C 200 240, 224 240, 232 266 Z'), '#3F6E94', true],
      [c(158, 296, 6), '#FBF9F3', false],
    ],
  },
  pear: {
    cord: 208,
    shapes: [
      [p('M204 220 C 228 200, 258 208, 266 230 C 244 242, 220 238, 204 220Z'), '#5C7C44', true],
      [p('M200 224 C 222 224, 232 250, 232 270 C 232 296, 264 312, 264 348 C 264 382, 232 400, 200 400 C 168 400, 136 382, 136 348 C 136 312, 168 296, 168 270 C 168 250, 178 224, 200 224Z'), '#A9B85A', true],
    ],
  },
  cloud: {
    cord: 246,
    shapes: [
      [p('M150 352 C 118 352, 108 312, 138 298 C 136 262, 180 246, 200 270 C 222 244, 268 262, 262 300 C 294 308, 288 352, 252 352 Z'), '#C6DAEA', true],
    ],
  },
};

function hardware(cordTo, cordColour) {
  return `
  <circle cx="200" cy="72" r="27" fill="none" stroke="${BRASS}" stroke-width="5"/>
  <path d="M181 55 A27 27 0 0 1 219 55" fill="none" stroke="#D9C592" stroke-width="2" stroke-linecap="round"/>
  <rect x="191" y="97" width="18" height="34" rx="9" fill="none" stroke="${BRASS}" stroke-width="5"/>
  <path d="M200 131 L200 ${cordTo}" stroke="${cordColour}" stroke-width="4" stroke-linecap="round"/>`;
}

function draw(name, { background }) {
  const m = motifs[name];
  const body = [];
  for (const [d, colour, width] of m.lines ?? []) {
    body.push(`<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`);
  }
  for (const [el, fill, textured] of m.shapes) {
    body.push(el.replace('/>', ` fill="${fill}"/>`));
    if (textured) body.push(el.replace(/ stroke="[^"]*" stroke-width="[^"]*"/, '').replace('/>', ' fill="url(#st)"/>'));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" role="img" aria-label="${name} charm illustration">
  <defs>
    <pattern id="st" width="14" height="11" patternUnits="userSpaceOnUse">
      <path d="M1.5 2 L7 9 L12.5 2" fill="none" stroke="#000" stroke-opacity=".13" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </pattern>
  </defs>${background ? `\n  <rect width="400" height="500" fill="${TILE}"/>` : ''}${hardware(m.cord, '#8C8576')}
  ${body.join('\n  ')}
</svg>
`;
}

mkdirSync(join(root, 'samples'), { recursive: true });
mkdirSync(join(root, 'charms'), { recursive: true });
for (const name of Object.keys(motifs)) {
  writeFileSync(join(root, 'samples', `${name}.svg`), draw(name, { background: true }));
  writeFileSync(join(root, 'charms', `${name}.svg`), draw(name, { background: false }));
}
console.log(`Wrote ${Object.keys(motifs).length} sample illustrations.`);
