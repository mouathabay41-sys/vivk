
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = req.body || {};
    const type = body.type || "chat";

    // تأكد من وجود المفتاح في المتغيرات البيئية
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server missing OPENAI_API_KEY env var" });
    }

    if (type === "image") {
      const { prompt, size = "1024x1024" } = body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required for image generation" });

      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1", // واجهة الصور
          prompt,
          size,     // "256x256" | "512x512" | "1024x1024"
          n: 1,
          response_format: "b64_json" // نأخذ الصورة بالـ base64
        }),
      });

      const data = await resp.json();
      if (data.error) return res.status(500).json({ error: data.error.message || data });

      const b64 = data.data?.[0]?.b64_json;
      if (!b64) return res.status(500).json({ error: "No image returned" });

      const dataUrl = `data:image/png;base64,${b64}`;
      return res.status(200).json({ image: dataUrl });
    }

    // ======= chat (نص) =======
    const { message } = body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // system prompt: اجعل المساعد باسم Vivk AI وبأسلوب ودّي وبسيط
    const systemPrompt = `أنت "فييك - Vivk AI"؛ مساعد ذكي ودود، تجاوب بالعربية أو الإنجليزية حسب المستخدم، تشرح مبسطًا وتقدم أمثلة عند الحاجة. ردود قصيرة مفيدة.`;

    const chatResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 800,
        temperature: 0.2
      }),
    });

    const chatData = await chatResp.json();
    if (chatData.error) return res.status(500).json({ error: chatData.error.message || chatData });

    const reply = chatData.choices?.[0]?.message?.content || "عذرًا، لم يصلنا رد.";
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("API handler error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}