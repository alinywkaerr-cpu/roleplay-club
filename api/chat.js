

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, character, memory, group, participants } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Напиши сообщение" });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ИИ пока не подключён. Нужно добавить ключ Groq в настройки Vercel."
      });
    }

    const participantList = Array.isArray(participants)
      ? participants.filter(x => typeof x === "string").join(", ")
      : "";

    let systemContent;

    if (group && participantList) {
      systemContent = `Ты ведёшь групповой ролевой чат. Участники: ${participantList}.

Играй за этих персонажей, а не за пользователя. Пиши реплики разных персонажей, явно указывая имя перед каждой репликой. Необязательно задействовать всех персонажей в каждом ответе. Сохраняй различия в характерах и манере речи. Не управляй действиями, словами и мыслями пользователя. Учитывай контекст переписки и не выдумывай неизвестные факты канона.`;
    } else {
      systemContent = `Ты играешь роль персонажа ${character || "собеседник"} в ролевой истории. Отвечай естественно, живо и последовательно. Не управляй действиями, словами и мыслями пользователя. Не выходи из роли без необходимости. Не выдумывай неизвестные факты канона.`;
    }

    if (typeof memory === "string" && memory.trim()) {
      systemContent += `

ПАМЯТЬ ЭТОГО СЮЖЕТА:
${memory.trim()}

Учитывай её как уже произошедшие события. Не противоречь ей.`;
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: systemContent },
            ...messages.slice(-30)
          ],
          temperature: 0.85,
          max_tokens: 1000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Ошибка ИИ"
      });
    }

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content || ""
    });

  } catch (error) {
    return res.status(500).json({
      error: "Не удалось связаться с ИИ"
    });
  }
}
