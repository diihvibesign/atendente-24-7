const targets = process.argv.slice(2);
if (!targets.length) throw new Error("Informe as URLs de readiness.");
for (let attempt = 0; attempt < 30; attempt++) {
  const results = await Promise.allSettled(
    targets.map(async (url) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (!r.ok) throw new Error("indisponível");
    }),
  );
  if (results.every((result) => result.status === "fulfilled")) {
    console.log("Serviços respondem aos checks HTTP.");
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error("Serviços não ficaram disponíveis no prazo.");
process.exit(1);
