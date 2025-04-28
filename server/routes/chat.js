import { Router } from 'express';
import axios from 'axios';

const router = Router();
const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) throw new Error('HF_TOKEN не задан в .env');

const BASE_HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  'Content-Type': 'application/json',
  'x-wait-for-model': 'true'   
};
const TIMEOUT = 60000;

async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 503 && i < retries) {
        console.warn(`503, retry ${i + 1}/${retries}…`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;

  try {
    const llamaRes = await withRetry(() =>
      axios.post(
        'https://api-inference.huggingface.co/pipeline/chat/meta-llama/Llama-2-7b-chat-hf',
        {
          inputs: [
            { role: 'system',    content: 'You are a helpful, friendly assistant.' },
            { role: 'user',      content: message }
          ]
        },
        { headers: BASE_HEADERS, timeout: TIMEOUT }
      )
    );
    const reply = llamaRes.data.generated_text?.trim();
    if (reply) {
      return res.json({ reply });
    }
  } catch (err) {
    console.warn('Llama-2 Chat failed:', err.response?.status);
  }

  try {
    const bbRes = await withRetry(() =>
      axios.post(
        'https://api-inference.huggingface.co/pipeline/chat/facebook/blenderbot-400M-distill',
        {
          inputs: [
            { role: 'system', content: 'You are a helpful, friendly assistant.' },
            { role: 'user',   content: message }
          ]
        },
        { headers: BASE_HEADERS, timeout: TIMEOUT }
      )
    );
    const reply2 = bbRes.data.generated_text?.trim();
    if (reply2) {
      return res.json({ reply: reply2 });
    }
  } catch (err) {
    console.warn('BlenderBot fallback failed:', err.response?.status);
  }

  return res.json({
    reply: 'К сожалению, сейчас сервис перегружен — попробуйте чуть позже.'
  });
});

export default router;
