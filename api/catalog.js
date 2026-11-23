

async function searchWikidata(query) {
  const url = new URL("https://www.wikidata.org/w/api.php");

  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "ru",
    uselang: "ru",
    type: "item",
    limit: "10",
    format: "json",
    origin: "*"
  }).toString();

  const response = await fetch(url);
  if (!response.ok) throw new Error("Wikidata временно недоступна");

  const data = await response.json();

  return (data.search || []).map(item => ({
    id: "wikidata_" + item.id,
    name: item.label || "",
    description: item.description || "",
    image: "",
    source: "Wikidata",
    category: "Игры",
    game: ""
  }));
}

async function searchVndb(query) {
  const response = await fetch(
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

  if (!response.ok) throw new Error("VNDB временно недоступна");

  const data = await response.json();

  return (data.results || []).map(character => ({
    id: "vndb_" + character.id,
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
    return res.status(405).json({
      error: "Метод не поддерживается"
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
    return res.status(400).json({
      error: "Введи имя персонажа"
    });
  }

  try {
    let results;

    if (source === "wikidata") {
      results = await searchWikidata(query);
    } else if (source === "vndb") {
      results = await searchVndb(query);
    } else {
      return res.status(400).json({
        error: "Неизвестный источник"
      });
    }

    return res.status(200).json({
      results,
      source,
      query
    });

  } catch (error) {
    console.error("Catalog error:", error);

    return res.status(500).json({
      error: "Не удалось выполнить поиск. Попробуй ещё раз."
    });
  }
};
