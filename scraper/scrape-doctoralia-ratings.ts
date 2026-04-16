import * as fs from "fs";
import * as path from "path";
import { scrapeDoctoralia } from "./sources/doctoralia-ratings";

const OUT = path.join(__dirname, "../data/doctoralia-ratings.json");

function argInt(name: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const n = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const limitEspecialidades = argInt("limit-esp");
  const limitProvincias = argInt("limit-prov");
  console.log(
    `Doctoralia ratings · limitEsp=${limitEspecialidades ?? "∞"} limitProv=${
      limitProvincias ?? "∞"
    }`
  );
  const t0 = Date.now();
  const profiles = await scrapeDoctoralia({
    limitEspecialidades,
    limitProvincias,
  });
  const elapsedMin = ((Date.now() - t0) / 60000).toFixed(1);
  fs.writeFileSync(OUT, JSON.stringify(profiles));
  const sizeMb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(
    `\n✓ ${profiles.length} perfiles → ${path.relative(
      process.cwd(),
      OUT
    )} (${sizeMb} MB, ${elapsedMin} min)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
