// frames/frame_NNNNN.png + frames/times.txt (ms per frame) -> out.gif
// Global palette, unchanged pixels made transparent so LZW compresses the static UI away.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const dir = process.argv[2] || 'frames';
const out = process.argv[3] || 'out.gif';
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const times = readFileSync(`${dir}/times.txt`, 'utf8').trim().split('\n').map(Number);
if (files.length === 0) throw new Error('no frames');

const decode = (f) => PNG.sync.read(readFileSync(`${dir}/${f}`));
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
