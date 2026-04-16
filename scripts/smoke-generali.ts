import { filterDoctors } from "../lib/search";

async function main() {
  const cases: Array<[string, string]> = [
    ["28001", "Cardiología"],
    ["08001", "Dermatología"],
  ];
  for (const [cp, esp] of cases) {
    const r = await filterDoctors("Generali", esp, cp);
    console.log(`\n=== Generali ${cp} / ${esp} → ${r.length} ===`);
    if (r.length) {
      console.log("First:", JSON.stringify(r[0], null, 2));
      if (r.length >= 3) console.log("Sample[2]:", JSON.stringify(r[2], null, 2));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
