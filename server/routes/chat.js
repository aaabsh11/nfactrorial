import { Router } from 'express';
import axios from 'axios';

const router = Router();

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  throw new Error('HF_TOKEN не задан. Установите переменную окружения HF_TOKEN');
}

const MODEL_URL = 'https://api-inference.huggingface.co/models/google/flan-t5-small';
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
        console.warn(`HF 503, повторная попытка ${i + 1}/${retries}…`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;

  const prompt =
    "You are a helpful, friendly assistant.\n" +
    "Answer the user clearly and concisely.\n\n" +
    `User: ${message}\nAssistant:`;

  try {
    const hfRes = await queryWithRetry({ inputs: prompt });
    const reply =
      hfRes.data.generated_text ||
      hfRes.data[0]?.generated_text ||
      '';
    return res.json({ reply: reply.trim() });
  } catch (err) {
    console.error('HuggingFace error', err.response?.status, err.message);
   
    return res.json({
      reply: 'Sorry, the service is temporarily unavailable. Try again later.'
    });
  }
});

export default router;
