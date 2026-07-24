const NOTION_VERSION = "2025-09-03";
const API = "https:" + "//api.notion.com/v1";
const GENDERS = ["Male", "Female"];
const LEVELS = ["A", "B", "C"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type,x-app-key",
  };
}
function json(data, status, env) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...cors(env) } });
}
async function notion(env, path, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${env.NOTION_TOKEN}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Notion ${response.status}: ${body.message || "request failed"}`);
  return body;
}
function simplify(page) {
  const p = page.properties || {};
  const name = p["Player Name"]?.title?.[0]?.plain_text || "(untitled)";
  const gender = p.Gender?.select?.name || null;
  const level = p.Level?.select?.name || null;
  const active = p.Active?.checkbox === true;
  return { id: page.id, name, gender, level, active, incomplete: !name || !gender || !level };
}
function validate(input, partial = false) {
  if (!input || typeof input !== "object") return ["body", "JSON object required"];
  const allowed = ["name", "gender", "level", "active"];
  const unknown = Object.keys(input).find((key) => !allowed.includes(key));
  if (unknown) return [unknown, "Unknown field"];
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) return ["name", "Name must be 1–100 characters"];
  }
  if (input.gender !== undefined && !GENDERS.includes(input.gender)) return ["gender", "Gender must be Male or Female"];
  if (input.level !== undefined && !LEVELS.includes(input.level)) return ["level", "Level must be A, B, or C"];
  if (input.active !== undefined && typeof input.active !== "boolean") return ["active", "Active must be boolean"];
  return null;
}
async function queryAll(env) {
  const results = [];
  let cursor;
  do {
    const body = {
      page_size: 100,
      sorts: [{ property: "Player Name", direction: "ascending" }],
      filter: { property: "Active", checkbox: { equals: true } },
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const page = await notion(env, `/data_sources/${env.PLAYERS_DATA_SOURCE_ID}/query`, { method: "POST", body: JSON.stringify(body) });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return results.map(simplify);
}
async function createPlayer(env, input) {
  const page = await notion(env, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: env.PLAYERS_DATA_SOURCE_ID },
      properties: {
        "Player Name": { title: [{ text: { content: input.name.trim() } }] },
        Gender: { select: { name: input.gender } },
        Level: { select: { name: input.level } },
        Active: { checkbox: true },
      },
    }),
  });
  return simplify(page);
}
async function updatePlayer(env, id, input) {
  const properties = {};
  if (input.name !== undefined) properties["Player Name"] = { title: [{ text: { content: input.name.trim() } }] };
  if (input.gender !== undefined) properties.Gender = { select: { name: input.gender } };
  if (input.level !== undefined) properties.Level = { select: { name: input.level } };
  if (input.active !== undefined) properties.Active = { checkbox: input.active };
  return simplify(await notion(env, `/pages/${id}`, { method: "PATCH", body: JSON.stringify({ properties }) }));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if ((request.headers.get("x-app-key") || "") !== (env.APP_KEY || "")) return json({ error: "Unauthorized" }, 401, env);
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (parts.join("/") === "api/players" && request.method === "GET") return json({ players: await queryAll(env) }, 200, env);
      if (parts.join("/") === "api/players" && request.method === "POST") {
        let input;
        try { input = await request.json(); } catch { return json({ error: "Invalid JSON", field: "body" }, 400, env); }
        const error = validate(input);
        if (error) return json({ error: error[1], field: error[0] }, 400, env);
        return json(await createPlayer(env, input), 201, env);
      }
      if (parts[0] === "api" && parts[1] === "players" && parts[2] && request.method === "PATCH") {
        if (!UUID.test(parts[2])) return json({ error: "Player id must be a UUID", field: "id" }, 400, env);
        let input;
        try { input = await request.json(); } catch { return json({ error: "Invalid JSON", field: "body" }, 400, env); }
        const error = validate(input, true);
        if (error) return json({ error: error[1], field: error[0] }, 400, env);
        return json(await updatePlayer(env, parts[2], input), 200, env);
      }
      return json({ error: "Not found" }, 404, env);
    } catch (error) {
      return json({ error: String(error.message || error) }, 500, env);
    }
  },
};