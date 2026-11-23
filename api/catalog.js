
const https = require("https");

let igdbToken = null;
let igdbTokenExpires = 0;

function send(res, status, data) {
  res.status(status).json(data);
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Ошибка API: ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getIgdbToken() {
  if (igdbToken && Date.now() < igdbTokenExpires) {
    return igdbToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Не настроены ключи IGDB в Vercel.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });

  const data = await fetchJson(
    "https://id.twitch.tv/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    }
  );

  igdbToken = data.access_token;
  igdbTokenExpires = Date.now() + (data.expires_in - 300) * 1000;

  return igdbToken;
}

async function searchIgdb(query) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getIgdbToken();

  const body = `
    search "${query.replace(/["\\]/g, "")}";
    fields name, description, mug_shot.image_id, games.name;
    limit 10;
  `;

  const data = await fetchJson(
    "https://api.igdb.com/v4/characters",
    {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "text/plain"
      },
      body
    }
  );

  return data.map(character => ({
    id: `igdb_${character.id}`,
    name: character.name,
    description: character.description || "",
    image: character.mug_shot?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${character.mug_shot.image_id}.jpg`
      : "",
    source: "IGDB",
    category: "Игры",
    game: character.games?.[0]?.name || ""
  }));
}

async function searchVndb(query) {
  const data = await fetchJson(
    "https://api.vndb.org/kana/character",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filters: ["search", "=", query],
        fields: "id,name,original,description,image.url,vns.title",
        results: 10,
        sort: "searchrank"
      })
    }
  );

  return (data.results || []).map(character => ({
    id: `vndb_${character.id}`,
    name: character.name,
    description: character.description || "",
    image: character.image?.url || "",
    source: "VNDB",
    category: "Визуальные новеллы",
    game: character.vns?.[0]?.title || ""
  }));
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return send(res, 405, {
      error: "Метод не поддерживается."
    });
  }

  const query = String(
    req.method === "POST"
      ? req.body?.query || ""
      : req.query?.query || ""
  ).trim().slice(0, 80);

  const source = String(
    req.method === "POST"
      ? req.body?.source || ""
      : req.query?.source || ""
  ).toLowerCase();

  if (!query) {
    return send(res, 400, {
      error: "Введи имя персонажа для поиска."
    });
  }

  try {
    let results;

    if (source === "igdb") {
      results = await searchIgdb(query);
    } else if (source === "vndb") {
      results = await searchVndb(query);
    } else {
      return send(res, 400, {
        error: "Неизвестный источник поиска."
      });
    }

    return send(res, 200, {
      results,
      source,
      query
    });

  } catch (error) {
    console.error("Catalog API error:", error);

    return send(res, 500, {
      error: error.message || "Не удалось выполнить поиск."
    });
  }
};
