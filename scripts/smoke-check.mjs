const API_BASE_URL = process.env.SMOKE_API_URL || process.env.VITE_API_URL;

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

const run = async () => {
  console.log(`Smoke check base URL: ${baseUrl}`);

  const healthRes = await fetch(`${baseUrl}/health`);
  const health = await assertOk(healthRes, "health");
  console.log("health:", health.status, health.checks?.database || "n/a");

  const readyRes = await fetch(`${baseUrl}/health/ready`);
  const ready = await assertOk(readyRes, "health-ready");
  if (ready.status !== "ready") {
    throw new Error(`health-ready returned ${JSON.stringify(ready)}`);
  }
  console.log("health-ready:", ready.status);

  console.log("Smoke check passed.");
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
