const API_BASE_URL = process.env.SMOKE_API_URL || process.env.VITE_API_URL;
const CHECK_DAYS = Number(process.env.RELEASE_CHECK_DAYS || 7);

if (!API_BASE_URL) {
  console.error("Missing API URL. Set SMOKE_API_URL or VITE_API_URL.");
  process.exit(1);
}

const baseUrl = API_BASE_URL.replace(/\/+$/, "");

const parseJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const assertOk = async (response, stepName) => {
  if (!response.ok) {
    const body = await parseJson(response);
    throw new Error(`${stepName} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return parseJson(response);
};

const checkHealth = async () => {
  const healthRes = await fetch(`${baseUrl}/health`);
  const health = await assertOk(healthRes, "health");
  if (health.status !== "ok") {
    throw new Error(`health returned status=${health.status}`);
  }
  console.log("health ok:", health.checks?.database || "n/a");
};

const checkReadiness = async () => {
  const readyRes = await fetch(`${baseUrl}/health/ready`);
  const ready = await assertOk(readyRes, "health-ready");
  if (ready.status !== "ready") {
    throw new Error(`ready endpoint returned ${JSON.stringify(ready)}`);
  }
  console.log("ready ok");
};

const checkTelemetrySummary = async () => {
  const summaryRes = await fetch(`${baseUrl}/telemetry/summary?days=${CHECK_DAYS}`);
  const summary = await assertOk(summaryRes, "telemetry-summary");
  if (typeof summary.totalEvents !== "number" || !summary.funnel || !summary.rates) {
    throw new Error(`telemetry summary shape invalid: ${JSON.stringify(summary)}`);
  }
  console.log("telemetry summary ok");
};

const run = async () => {
  console.log(`Release check base URL: ${baseUrl}`);
  await checkHealth();
  await checkReadiness();
  await checkTelemetrySummary();
  console.log("Release check passed.");
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
