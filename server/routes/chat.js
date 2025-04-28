// server/routes/chat.js
import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Убедитесь, что в Render/Env Vars задан HF_TOKEN=hf_...
const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  throw new Error('HF_TOKEN не задан в переменных окружения.');
}

const MODEL_URL = 'https://api-inference.huggingface.co/models/distilgpt2';
const HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  'Content-Type': 'application/json',
  // Ждём загрузки модели вместо мгновенного 503
  'x-wait-for-model': 'true'
};
const TIMEOUT = 60000;

// Простая функция с одной повторной попыткой при 503
async function queryWithRetry(prompt) {
  try {
    return await axios.post(
      MODEL_URL,
      { inputs: prompt },
      { headers: HEADERS, timeout: TIMEOUT }
    );
  } catch (err) {
    if (err.response?.status === 503) {
      // повторяем один раз
      return await axios.post(
        MODEL_URL,
        { inputs: prompt },
        { headers: HEADERS, timeout: TIMEOUT }
      );
    }
    throw err;
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // Просто передаём сообщение как промпт:
  const prompt = message;

  try {
    const hfRes = await queryWithRetry(prompt);
    // Ответ приходит в data[0].generated_text
    const raw = hfRes.data[0]?.generated_text || '';
    // Обрезаем оригинальный prompt, оставляем только сгенерированное
    const reply = raw.startsWith(prompt) ? raw.slice(prompt.length).trim() : raw.trim();
    return res.json({ reply: reply || '...' });
  } catch (err) {
    console.error('HuggingFace error', err.response?.status, err.message);
    return res.json({ reply: 'Извините, сейчас не могу ответить.' });
  }
});

export default router;
