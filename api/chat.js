


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
    const {
      messages,
      character,
      memory,
      group,
      participants,
      profiles
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Напиши сообщение" });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ИИ пока не подключён. Нужно добавить ключ Groq в настройки Vercel."
      });
    }

    // Оставляем только корректные сообщения.
    const safeMessages = messages
      .filter(message =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
      )
      .slice(-40)
      .map(message => ({
        role: message.role,
        content: message.content.slice(0, 12000)
      }));

    if (!safeMessages.length) {
      return res.status(400).json({
        error: "Не удалось прочитать сообщения"
      });
    }

    const participantNames = Array.isArray(participants)
      ? participants
          .filter(name => typeof name === "string")
          .map(name => name.trim())
          .filter(Boolean)
      : [];

    // Получаем анкеты персонажей.
    const profileData =
      profiles && typeof profiles === "object"
        ? profiles
        : {};

    const profileFields = [
      ["description", "Описание"],
      ["age", "Возраст"],
      ["appearance", "Внешность"],
      ["personality", "Характер"],
      ["speech", "Манера речи"],
      ["habits", "Привычки"],
      ["backstory", "Биография"]
    ];

    function getProfile(name) {
      const profile = profileData[name];

      if (!profile || typeof profile !== "object") {
        return "";
      }

      const lines = [];

      for (const [field, label] of profileFields) {
        const value = profile[field];

        if (typeof value === "string" && value.trim()) {
          lines.push(`${label}: ${value.trim().slice(0, 3000)}`);
        }
      }

      return lines.join("\n");
    }

    const names = group
      ? participantNames
      : [character || "Собеседник"];

    const characterProfiles = names
      .map(name => {
        const profile = getProfile(name);

        return profile
          ? `ДОСЬЕ ПЕРСОНАЖА: ${name}\n${profile}`
          : `ДОСЬЕ ПЕРСОНАЖА: ${name}\nПодробная анкета не заполнена. Не придумывай ей факты из неизвестной биографии.`;
      })
      .join("\n\n");

    let systemContent;

    if (group && participantNames.length) {
      systemContent = `
Ты — ведущий группового ролевого чата.

ТВОЯ ЗАДАЧА:
Играй за перечисленных персонажей, сохраняя их индивидуальность.
Ты не являешься пользователем и не должен писать за него.

УЧАСТНИКИ:
${participantNames.join(", ")}

${characterProfiles}

ПРАВИЛА ГРУППОВОЙ РОЛЕВОЙ:

1. Каждый персонаж должен говорить и действовать в соответствии со своим досье.
2. Не смешивай характеры, привычки, манеру речи и биографии разных персонажей.
3. Необязательно задействовать всех участников в каждом ответе.
4. Не заставляй персонажей постоянно соглашаться друг с другом.
5. Разрешены споры, шутки, конфликты, ревность, неловкость, инициативные действия и неожиданные реакции, если они подходят ситуации.
6. Перед каждой репликой явно указывай имя персонажа.
7. Не повторяй одну и ту же мысль разными персонажами.
8. Следи за тем, кто присутствует в сцене и что каждый из них уже знает.
9. Не заставляй персонажей знать чужие секреты без причины.
10. Не управляй словами, действиями, чувствами и мыслями пользователя.

СТИЛЬ ОТЫГРЫША:

Пиши живо, естественно и атмосферно.
Используй диалоги, действия, реакции, жесты, выражения лиц и детали окружающей обстановки.
Не превращай каждую сцену в сухой обмен короткими репликами.
Не растягивай ответы бессмысленными описаниями.
Поддерживай события, которые развивает пользователь.
Не пересказывай предыдущие сообщения вместо продолжения сцены.

СОХРАНЕНИЕ РОЛИ:

Не выходи из роли без необходимости.
Не объясняй пользователю, что ты искусственный интеллект.
Не придумывай неизвестные факты канона.
`;

    } else {
      systemContent = `
Ты играешь роль персонажа ${character || "Собеседник"} в ролевой истории.

${characterProfiles}

ТВОЯ ЛИЧНОСТЬ:

Соблюдай характер, биографию, привычки, внешность и манеру речи из досье.
Не делай персонажа безликим помощником.
Он может иметь собственное мнение, желания, страхи, слабости, симпатии и антипатии.
Он не обязан соглашаться с пользователем.
Он может проявлять инициативу, задавать вопросы, шутить, спорить, обижаться, ревновать и совершать ошибки, если это соответствует его характеру.

ПРАВИЛА РОЛЕВОЙ:

1. Не управляй действиями, словами, мыслями и чувствами пользователя.
2. Не описывай за пользователя то, чего он не делал.
3. Не решай за пользователя, как он реагирует на события.
4. Не перескакивай через важные моменты сцены.
5. Помни о предыдущих событиях и отношениях персонажей.
6. Не повторяй постоянно одни и те же фразы, жесты и реакции.
7. Не превращай каждый ответ в одинаковое описание улыбки, взгляда или вздоха.
8. Не придумывай неизвестные факты канона.
9. Не выходи из роли без необходимости.

СТИЛЬ ОТЫГРЫША:

Пиши естественно, эмоционально и последовательно.
Используй диалоги, действия, жесты, мимику и окружающую обстановку.
Длина ответа зависит от ситуации: важные сцены могут быть подробными, обычный разговор — более коротким.
Не ограничивайся двумя предложениями, если сцена требует полноценного продолжения.
Не пиши огромные бессмысленные монологи.
Не пересказывай действия пользователя — реагируй на них и развивай сцену.
`;

    }

    // Ручная память конкретной ролевой.
    if (typeof memory === "string" && memory.trim()) {
      systemContent += `

ВАЖНАЯ ПАМЯТЬ ЭТОГО СЮЖЕТА:

${memory.trim().slice(0, 12000)}

Считай перечисленные события уже произошедшими.
Не противоречь установленным фактам.
Не переноси события из других ролевых историй.
Если в памяти есть незавершённые события, учитывай их при продолжении.
`;
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
            {
              role: "system",
              content: systemContent
            },
            ...safeMessages
          ],
          temperature: 0.9,
          max_tokens: 1400
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);

      return res.status(response.status).json({
        error: data.error?.message || "Ошибка ИИ"
      });
    }

    const reply = data.choices?.[0]?.message?.content || "";

    if (!reply.trim()) {
      return res.status(500).json({
        error: "ИИ вернул пустой ответ. Попробуй ещё раз."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat handler error:", error);

    return res.status(500).json({
      error: "Не удалось связаться с ИИ"
    });
  }
}
