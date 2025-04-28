import { Router } from 'express';
import axios from 'axios';

const router = Router();

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  throw new Error('HF_TOKEN не задан в .env');
}

const MODEL_URL = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-small';
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
        console.warn(`HF 503, retry ${i + 1}/${retries}…`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const hfRes = await queryWithRetry({ inputs: message });
    const reply = (hfRes.data[0]?.generated_text || '').trim();
    return res.json({ reply: reply || '...' });
  } catch (err) {
    console.error('HuggingFace error', err.response?.status, err.message);
    return res.json({
      reply: 'Sorry, the service is temporarily unavailable. Try again later.'
    });
  }
});

export default router;
