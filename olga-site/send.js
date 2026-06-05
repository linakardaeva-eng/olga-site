export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // ── Антиспам 1: запрос должен прийти с нашего сайта ──────────────────────────
  // Боты-сканеры бьют по /api/send напрямую (curl) и обычно не шлют Origin/Referer
  // с нашего домена. Отсекаем всё, что пришло не с olgapahomova.ru.
  const ALLOWED_HOST = 'olgapahomova.ru';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const fromOurSite =
    origin.includes(ALLOWED_HOST) || referer.includes(ALLOWED_HOST);
  if (!fromOurSite) {
    // Молча отвечаем «ок», чтобы бот не понял, что его отсекли.
    return res.status(200).json({ ok: true });
  }

  const { text, website } = req.body;

  // ── Антиспам 2: honeypot ────────────────────────────────────────────────────
  // Поле `website` скрыто от людей. Если оно заполнено — это бот.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  // ── Антиспам 3: текст должен быть нашей заявкой, а не произвольным мусором ────
  if (typeof text !== 'string' || !text.startsWith('🌟 Новая заявка с сайта!')) {
    return res.status(200).json({ ok: true });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });

    const data = await tgRes.json();

    if (!data.ok) {
      return res.status(500).json({ error: 'Telegram error', details: data });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Network error', details: err.message });
  }
}
