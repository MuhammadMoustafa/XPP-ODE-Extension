// frames/frame_NNNNN.png + frames/times.txt (ms per frame) -> out.gif
// Global palette, unchanged pixels made transparent so LZW compresses the static UI away.
// Frames are scaled (area average) to WIDTH px wide, 1600 by default: sharp code text, a smaller
// file; 0 keeps the captured size. Optional 5th and 6th arguments keep only frames FROM..TO (inclusive),
// to cut one recording into several GIFs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const dir = process.argv[2] || 'frames';
const out = process.argv[3] || 'out.gif';
const targetWidth = Number(process.argv[4] ?? 1600);
const from = Number(process.argv[5] ?? 0);
const allFiles = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const to = Number(process.argv[6] ?? allFiles.length - 1);
const files = allFiles.slice(from, to + 1);
const times = readFileSync(`${dir}/times.txt`, 'utf8').trim().split('\n').map(Number).slice(from, to + 1);
if (files.length === 0) throw new Error('no frames');

// Area-average downscale of an RGBA PNG to `w` px wide; returns the PNG unchanged when no scaling applies.
function scaled(png, w) {
    if (!w || w >= png.width) return png;
    const h = Math.round((png.height * w) / png.width);
    const data = new Uint8Array(w * h * 4);
    const fx = png.width / w;
    const fy = png.height / h;
    for (let y = 0; y < h; y++) {
        const y0 = Math.floor(y * fy);
        const y1 = Math.max(y0 + 1, Math.min(png.height, Math.ceil((y + 1) * fy)));
        for (let x = 0; x < w; x++) {
            const x0 = Math.floor(x * fx);
            const x1 = Math.max(x0 + 1, Math.min(png.width, Math.ceil((x + 1) * fx)));
            let r = 0, g = 0, b = 0;
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * png.width + xx) * 4;
                    r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2];
                }
            }
            const n = (y1 - y0) * (x1 - x0);
            const o = (y * w + x) * 4;
            data[o] = r / n; data[o + 1] = g / n; data[o + 2] = b / n; data[o + 3] = 255;
        }
    }
    return { width: w, height: h, data };
}

const decode = (f) => scaled(PNG.sync.read(readFileSync(`${dir}/${f}`)), targetWidth);
const first = decode(files[0]);
const { width, height } = first;

// palette from a sample of frames
const step = Math.max(1, Math.floor(files.length / 12));
const sample = [];
for (let i = 0; i < files.length; i += step) sample.push(decode(files[i]).data);
const all = new Uint8Array(sample.reduce((n, d) => n + d.length, 0));
let off = 0;
for (const d of sample) { all.set(d, off); off += d.length; }
const palette = quantize(all, 255, { format: 'rgb565' });
while (palette.length < 256) palette.push([0, 0, 0]);
const TRANSPARENT = 255;

const gif = GIFEncoder();
let prev = null;          // composited indexed frame
let pending = null;       // { index, delay } waiting for the next differing frame
let written = 0;

function flush() {
    if (!pending) return;
    const opts = { delay: Math.max(20, Math.round(pending.delay)), dispose: 1 };
    if (written === 0) Object.assign(opts, { palette, first: true, repeat: 0 });
    else Object.assign(opts, { transparent: true, transparentIndex: TRANSPARENT });
    gif.writeFrame(pending.index, width, height, opts);
    written++;
    pending = null;
}

for (let i = 0; i < files.length; i++) {
    const png = i === 0 ? first : decode(files[i]);
    if (png.width !== width || png.height !== height) throw new Error(`frame ${files[i]} has another size`);
    const index = applyPalette(png.data, palette, 'rgb565');
    for (let p = 0; p < index.length; p++) if (index[p] === TRANSPARENT) index[p] = TRANSPARENT - 1;
    const delay = i + 1 < times.length ? times[i + 1] - times[i] : 1500;
    if (prev === null) {
        prev = index;
        pending = { index: index.slice(), delay };
        continue;
    }
    let changed = 0;
    const diff = new Uint8Array(index.length);
    for (let p = 0; p < index.length; p++) {
        if (index[p] === prev[p]) diff[p] = TRANSPARENT;
        else { diff[p] = index[p]; changed++; }
    }
    if (changed === 0) { pending.delay += delay; continue; }
    flush();
    pending = { index: diff, delay };
    prev = index;
}
flush();
gif.finish();
const bytes = gif.bytes();
writeFileSync(out, bytes);
console.log(`${out}: ${written} frames of ${files.length}, ${width}x${height}, ${(bytes.length / 1048576).toFixed(2)} MB, ${(times[times.length - 1] - times[0]) / 1000}s`);
