import { searchDkv } from "../lib/sources/dkv";

async function main() {
  const cases: Array<[string, string]> = [
    ["28001", "Cardiología"],
    ["08001", "Dermatología"],
    ["46001", "Pediatría"],
    ["29001", "Traumatología"],
  ];
  for (const [cp, esp] of cases) {
    const r = await searchDkv(cp, esp);
    console.log(`\n=== ${cp} / ${esp} → ${r.length} results ===`);
    if (r.length) {
      console.log("First:", JSON.stringify(r[0], null, 2));
      if (r.length >= 3) console.log("Sample[2]:", JSON.stringify(r[2], null, 2));
    }
  }
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
