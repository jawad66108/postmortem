// server/test-endpoint.ts
const trace = `Traceback (most recent call last):
  File "app.py", line 12, in <module>
    import pandas as pd
  File "/usr/lib/python3/site-packages/pandas/__init__.py", line 22, in <module>
    from pandas.compat import is_numpy_dev
ImportError: cannot import name 'is_numpy_dev' from 'pandas.compat' (/usr/lib/python3/site-packages/pandas/compat/__init__.py)`;

async function main() {
  const res = await fetch("http://localhost:3001/api/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace }),
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main();
