const baseUrl = process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:5725";
const totalUsers = Number(process.env.LOAD_TEST_USERS || 100);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 20);
const difficulties = ["easy", "medium", "hard"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function postJson(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.error || ""}`);
  }
  return data;
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return data;
}

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return text;
}

async function runVirtualUser(index) {
  const difficulty = difficulties[index % difficulties.length];
  const start = await postJson("/api/game/start", { difficulty });
  assert(start.gameId, "missing gameId");
  assert(start.scenario?.opening, "missing opening");

  const reveal = await postJson("/api/game/reveal", { gameId: start.gameId });
  assert(reveal.hiddenTruth, "missing hiddenTruth");
  return start.gameId;
}

async function runPool() {
  const initialHealth = await getJson("/api/health");
  if (initialHealth.rateLimit?.maxRequests > 0 && initialHealth.rateLimit.maxRequests < totalUsers * 2) {
    console.warn("Tip: local load tests may hit API rate limits. Start the server with npm run start:loadtest for this smoke test.");
  }
  const initialMetrics = await getJson("/api/metrics");

  const startedAt = Date.now();
  let next = 0;
  let completed = 0;

  async function worker() {
    while (next < totalUsers) {
      const index = next;
      next += 1;
      await runVirtualUser(index);
      completed += 1;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, totalUsers) }, worker));
  const elapsedMs = Date.now() - startedAt;
  const health = await getJson("/api/health");
  const finalMetrics = await getJson("/api/metrics");
  const prometheusMetrics = await getText("/metrics");
  const startsDelta = finalMetrics.gameStartsTotal - initialMetrics.gameStartsTotal;
  const revealsDelta = finalMetrics.gameRevealsTotal - initialMetrics.gameRevealsTotal;
  const prometheusOk = prometheusMetrics.includes("ops_turtle_soup_game_starts_total") &&
    prometheusMetrics.includes("ops_turtle_soup_game_reveals_total");

  assert(completed === totalUsers, `completed ${completed} of ${totalUsers} users`);
  assert(startsDelta >= totalUsers, `gameStartsTotal increased by ${startsDelta}, expected at least ${totalUsers}`);
  assert(revealsDelta >= totalUsers, `gameRevealsTotal increased by ${revealsDelta}, expected at least ${totalUsers}`);
  assert(prometheusOk, "Prometheus metrics missing game counters");

  console.log(JSON.stringify({
    ok: true,
    totalUsers,
    concurrency,
    completed,
    elapsedMs,
    activeSessions: health.activeSessions,
    cachedScenarioSets: health.cachedScenarioSets,
    metricsDelta: {
      gameStartsTotal: startsDelta,
      gameRevealsTotal: revealsDelta,
      httpRequestsTotal: finalMetrics.httpRequestsTotal - initialMetrics.httpRequestsTotal,
      rateLimitedTotal: finalMetrics.rateLimitedTotal - initialMetrics.rateLimitedTotal
    },
    prometheusMetrics: {
      gameCountersPresent: prometheusOk
    }
  }, null, 2));
}

await runPool();
