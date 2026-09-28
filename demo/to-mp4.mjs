// frames/frame_NNNNN.png + frames/times.txt (ms per frame) -> out.mp4 (H.264, 30 fps, real frame timing)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const [dir = 'frames', out = 'out.mp4'] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const times = readFileSync(`${dir}/times.txt`, 'utf8').trim().split('\n').map(Number);

let list = '';
files.forEach((f, i) => {
    const seconds = (i + 1 < times.length ? times[i + 1] - times[i] : 1500) / 1000;
    list += `file '${f}'\nduration ${seconds.toFixed(3)}\n`;
});
list += `file '${files[files.length - 1]}'\n`;
writeFileSync(`${dir}/list.txt`, list);

execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`,
    '-fps_mode', 'cfr', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'animation',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(out);
