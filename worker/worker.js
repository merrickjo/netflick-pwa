// Netflick API — Cloudflare Worker + D1
//
// 28 Sep 2026: Notion retired. Players live in the D1 database bound as `DB`
// (schema: schema.sql). HTTP contract unchanged: GET/POST /api/players,
// PATCH /api/players/:id, same JSON shapes and validation.
//
// Required secret: APP_KEY. Optional var: ALLOWED_ORIGIN.
const GENDERS = ["Male", "Female"];
const LEVELS = ["A", "B", "C"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cors(env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type,x-app-key",
  };
}
export function json(data, status, env) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...cors(env) } });
}
function simplify(r) {
  const name = r.name || "(untitled)";
  const gender = r.gender || null;
  const level = r.level || null;
  return { id: r.id, name, gender, level, active: r.active === 1, incomplete: !r.name || !gender || !level };
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
const getPlayer = (env, id) => env.DB.prepare("SELECT * FROM players WHERE id = ?1").bind(id).first();

async function listActive(env) {
  const { results } = await env.DB.prepare("SELECT * FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE").all();
  return results.map(simplify);
}
async function createPlayer(env, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO players (id,name,gender,level,active,created_at,updated_at) VALUES (?1,?2,?3,?4,1,?5,?5)")
    .bind(id, input.name.trim(), input.gender ?? null, input.level ?? null, now).run();
  return simplify(await getPlayer(env, id));
}
async function updatePlayer(env, id, input) {
  const sets = [], vals = [];
  const set = (c, v) => { vals.push(v); sets.push(`${c} = ?${vals.length}`); };
  if (input.name !== undefined) set("name", input.name.trim());
  if (input.gender !== undefined) set("gender", input.gender);
  if (input.level !== undefined) set("level", input.level);
  if (input.active !== undefined) set("active", input.active ? 1 : 0);
  set("updated_at", new Date().toISOString());
  vals.push(id);
  const res = await env.DB.prepare(`UPDATE players SET ${sets.join(", ")} WHERE id = ?${vals.length}`).bind(...vals).run();
  return res.meta.changes ? simplify(await getPlayer(env, id)) : null;
}

export async function handle(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
  if (!env.APP_KEY || (request.headers.get("x-app-key") || "") !== env.APP_KEY) return json({ error: "Unauthorized" }, 401, env);
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  try {
    if (parts.join("/") === "api/players" && request.method === "GET") return json({ players: await listActive(env) }, 200, env);
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
      const player = await updatePlayer(env, parts[2], input);
      if (!player) return json({ error: "Player not found", field: "id" }, 404, env);
      return json(player, 200, env);
    }
    return json({ error: "Not found" }, 404, env);
  } catch (error) {
    return json({ error: String(error.message || error) }, 500, env);
  }
}
export default { fetch: handle };
