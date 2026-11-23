

const FANDOM_API = "https://romanceclub.fandom.com/ru/api.php";

async function searchWikidata(query) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "ru",
    format: "json",
    limit: "10"
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error("Wikidata недоступна");

  const data = await response.json();

  return (data.search || []).map(item => ({
    id: item.id,
    name: item.label,
    description: item.description || "",
    image: "",
    source: "Wikidata",
    category: "Игры",
    game: ""
  }));
}

async function searchVndb(query) {
  const response = await fetch("https://api.vndb.org/kana/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: ["search", "=", query],
      fields: "id,name,original,description,image.url,vns.title",
      results: 10,
      sort: "searchrank"
    })
  });

  if (!response.ok) throw new Error("VNDB недоступна");

  const data = await response.json();

  return (data.results || []).map(item => ({
    id: item.id,
    name: item.name,
    description: item.description || "",
    image: item.image?.url || "",
    source: "VNDB",
    category: "Визуальные новеллы",
    game: item.vns?.[0]?.title || ""
  }));
}

async function searchRomanceClub(query) {
  const url = new URL(FANDOM_API);

  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "0",
    srlimit: "15",
    format: "json"
  });

  const response = await fetch(url, {
    headers: { "User-Agent": "RoleplayClub/1.0" }
  });

  if (!response.ok) throw new Error("Вики Клуба Романтики недоступна");

  const data = await response.json();
  const pages = data.query?.search || [];

  if (!pages.length) return [];

  const imageUrl = new URL(FANDOM_API);
  imageUrl.search = new URLSearchParams({
    action: "query",
    pageids: pages.map(p => p.pageid).join("|"),
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "300",
    inprop: "url",
    format: "json"
  });

  const imageResponse = await fetch(imageUrl, {
    headers: { "User-Agent": "RoleplayClub/1.0" }
  });

  const imageData = imageResponse.ok
    ? await imageResponse.json()
    : { query: { pages: {} } };

  const pageInfo = imageData.query?.pages || {};

  return pages.map(item => {
    const page = pageInfo[item.pageid] || {};

    return {
      id: "rc-" + item.pageid,
      name: item.title,
      description: (item.snippet || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&"),
      image: page.thumbnail?.source || "",
      source: "Клуб Романтики",
      category: "Клуб Романтики",
      game: "Клуб Романтики",
      url: page.fullurl || 
        "https://romanceclub.fandom.com/ru/wiki/" +
        encodeURIComponent(item.title.replace(/ /g, "_"))
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Используй GET" });
  }

  const query = String(req.query.query || "").trim();
  const source = String(req.query.source || "").toLowerCase();

  if (!query) {
    return res.status(400).json({ error: "Введи имя персонажа" });
  }

  if (query.length > 100) {
    return res.status(400).json({ error: "Слишком длинный запрос" });
  }

  try {
    let results = [];

    if (source === "wikidata") {
      results = await searchWikidata(query);
    } else if (source === "vndb") {
      results = await searchVndb(query);
    } else if (
      source === "romanceclub" ||
      source === "romance" ||
      source === "rc"
    ) {
      results = await searchRomanceClub(query);
    } else {
      return res.status(400).json({
        error: "Неизвестный источник поиска"
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
      error: "Не удалось выполнить поиск",
      details: error.message
    });
  }
}

