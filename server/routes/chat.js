import { Router } from 'express';
import axios from 'axios';

const router = Router();

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  throw new Error('HF_TOKEN не задан. Установите его в переменных окружения.');
}

const MODEL_URL = 'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill';
const HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  'Content-Type': 'application/json',
  'x-wait-for-model': 'true'
};
const TIMEOUT = 60000;

async function queryWithRetry(body, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.post(MODEL_URL, body, { headers: HEADERS, timeout: TIMEOUT });
    } catch (err) {
      if (err.response?.status === 503 && i < retries) {
        console.warn(`503, retry ${i+1}/${retries}…`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  const prompt = `User: ${message}\nAssistant:`;

  try {
    const hfRes = await queryWithRetry({ inputs: prompt });
    const text =
      hfRes.data.generated_text ||
      hfRes.data[0]?.generated_text ||
      '';
    return res.json({ reply: text.trim() });
  } catch (err) {
    console.error('HuggingFace error', err.response?.status, err.response?.data || err.message);
    return res.json({
      reply: 'Sorry, the service is currently unavailable. Please try again later.'
    });
  }
});

export default router;
