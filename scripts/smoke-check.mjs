const API_BASE_URL = process.env.SMOKE_API_URL || process.env.VITE_API_URL;
const SMOKE_USERNAME = process.env.SMOKE_USERNAME || "smoke_user";

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

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SMOKE_USERNAME })
  });
  const login = await assertOk(loginRes, "login");
  if (!login.token) throw new Error("login did not return token");

  const rewardName = `smoke-${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/rewards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`
    },
    body: JSON.stringify({
      name: rewardName,
      description: "Smoke test reward",
      points: 100,
      type: "custom",
      active: true
    })
  });
  const reward = await assertOk(createRes, "create reward");
  console.log("create reward:", reward._id || reward.id || reward.name);

  console.log("Smoke check passed.");
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
