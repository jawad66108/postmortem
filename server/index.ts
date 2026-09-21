// server/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { extractFromTrace } from "./pipeline/extract";
import { retrieveEvidence } from "./pipeline/retrieve";
import { rankHypotheses } from "./pipeline/rank";
import { generateRepro } from "./pipeline/repro";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors()); // dev-friendly default — tighten to your deployed frontend origin before submitting
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/diagnose", async (req, res) => {
  const { trace } = req.body ?? {};

  if (typeof trace !== "string" || !trace.trim()) {
    return res
      .status(400)
      .json({ error: "Request body must include a non-empty 'trace' string." });
  }

  try {
    console.log("[diagnose] Extracting...");
    const extracted = await extractFromTrace(trace);

    console.log("[diagnose] Retrieving evidence...");
    const evidence = await retrieveEvidence(extracted);

    console.log("[diagnose] Ranking hypotheses...");
    const hypotheses = await rankHypotheses(extracted, evidence);

    console.log("[diagnose] Generating repro...");
    const repro = hypotheses[0]
      ? await generateRepro(extracted, hypotheses[0])
      : null;

    res.json({ extracted, evidence, hypotheses, repro });
  } catch (err) {
    console.error("[diagnose] Pipeline failed:", err);
    res.status(500).json({
      error: "Diagnosis pipeline failed.",
      detail: (err as Error).message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Postmortem server listening on http://localhost:${PORT}`);
});
