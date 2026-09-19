// server/test-models.ts
import "dotenv/config";
import { extractFromTrace } from "./pipeline/extract";
import { retrieveEvidence } from "./pipeline/retrieve";
import { rankHypotheses } from "./pipeline/rank";
import { generateRepro } from "./pipeline/repro";

const trace = `Traceback (most recent call last):
  File "app.py", line 12, in <module>
    import pandas as pd
  File "/usr/lib/python3/site-packages/pandas/__init__.py", line 22, in <module>
    from pandas.compat import is_numpy_dev
ImportError: cannot import name 'is_numpy_dev' from 'pandas.compat' (/usr/lib/python3/site-packages/pandas/compat/__init__.py)`;

async function main() {
  const extracted = await extractFromTrace(trace);
  console.log("Extracted:", JSON.stringify(extracted, null, 2));

  const evidence = await retrieveEvidence(extracted);
  console.log("Evidence:", JSON.stringify(evidence, null, 2));

  const hypotheses = await rankHypotheses(extracted, evidence);
  console.log("Hypotheses:", JSON.stringify(hypotheses, null, 2));

  const repro = await generateRepro(extracted, hypotheses[0]);
  console.log("Repro:", JSON.stringify(repro, null, 2));
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
