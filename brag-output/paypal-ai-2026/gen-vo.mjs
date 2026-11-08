// T4: per-line Kokoro TTS + duration probe → timings.json (durations only; placement set at composition).
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "Z:/Hackatons/Paypal/brag-output/paypal-ai-2026";
const VO = join(ROOT, "composition/assets/vo");
mkdirSync(VO, { recursive: true });
const spec = JSON.parse(readFileSync(join(ROOT, "vo-lines.json"), "utf8"));
const out = [];
for (const line of spec.lines) {
  const wav = join(VO, `${line.id}.wav`);
  if (!existsSync(wav)) {
    execSync(`hyperframes tts ${JSON.stringify(line.text)} --voice ${spec.voice} --speed ${spec.speed} -o ${JSON.stringify(wav)}`, { stdio: "pipe", shell: "cmd.exe" });
  }
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" }).trim());
  out.push({ ...line, seconds: Math.round(dur * 100) / 100 });
  console.log(`${line.id} ${dur.toFixed(2)}s`);
}
writeFileSync(join(ROOT, "vo-durations.json"), `${JSON.stringify(out, null, 1)}\n`);
const total = out.reduce((n, l) => n + l.seconds, 0);
console.log(`TOTAL_VO ${total.toFixed(1)}s over ${out.length} lines`);
