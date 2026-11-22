// Radar FC — servidor local (Node.js 18+)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.FOOTBALL_DATA_TOKEN || "";
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/matches") {
    if (!TOKEN) {
      return send(res, 503, JSON.stringify({
        error: "API_TOKEN_MISSING",
        message: "Configure FOOTBALL_DATA_TOKEN no ambiente do servidor para ativar os dados reais."
      }));
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "")
      ? url.searchParams.get("date")
      : new Date().toISOString().slice(0, 10);

    try {
      const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;
      const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": TOKEN }
      });
      const raw = await response.text();
      if (!response.ok) {
        return send(res, response.status, JSON.stringify({
          error: "FOOTBALL_API_ERROR",
          status: response.status,
          message: "A fonte de dados recusou a solicitação. Confira o token e o limite do plano."
        }));
      }
      const data = JSON.parse(raw);
      const matches = (data.matches || []).map(m => ({
        id: m.id,
        competition: m.competition?.name || "Campeonato",
        area: m.area?.name || "",
        utcDate: m.utcDate,
        status: m.status,
        minute: m.minute ?? null,
        homeTeam: m.homeTeam?.name || "Mandante",
        awayTeam: m.awayTeam?.name || "Visitante",
        homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null
      }));
      return send(res, 200, JSON.stringify({ date, count: matches.length, matches }));
    } catch (error) {
      return send(res, 502, JSON.stringify({
        error: "UPSTREAM_UNAVAILABLE",
        message: "Não foi possível consultar a fonte de futebol agora."
      }));
    }
  }

  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC, requested));
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Arquivo não encontrado", "text/plain; charset=utf-8");
    send(res, 200, data, MIME[path.extname(filePath)] || "application/octet-stream");
  });
});

server.listen(PORT, () => {
  console.log(`Radar FC rodando em http://localhost:${PORT}`);
});
