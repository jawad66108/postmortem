// server/test-models.ts
import "dotenv/config";
import { callModel, MODELS } from "./nebius/client";
import { extractFromTrace } from "./pipeline/extract";

const trace = `Traceback (most recent call last):
  File "app.py", line 12, in <module>
    import pandas as pd
  File "/usr/lib/python3/site-packages/pandas/__init__.py", line 22, in <module>
    from pandas.compat import is_numpy_dev
ImportError: cannot import name 'is_numpy_dev' from 'pandas.compat' (/usr/lib/python3/site-packages/pandas/compat/__init__.py)`;
extractFromTrace(trace).then((r) => console.log(JSON.stringify(r, null, 2)));
async function main() {
  for (const stage of Object.keys(MODELS) as (keyof typeof MODELS)[]) {
    try {
      const text = await callModel(
        stage,
        "You are a helpful assistant.",
        "Say hello in one short sentence.",
      );
      console.log(`✅ [${stage}] (${MODELS[stage]}) ->`, text);
    } catch (err) {
      console.error(
        `❌ [${stage}] (${MODELS[stage]}) failed:`,
        (err as Error).message,
      );
    }
  }
}

main();
