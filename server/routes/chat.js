// server/routes/chat.js
import { Router } from 'express';
import axios from 'axios';

const router = Router();
const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) throw new Error('HF_API_TOKEN не задан в .env');

const HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  'Content-Type': 'application/json'
};
const TIMEOUT = 60000;

// Попытка fn() до retries раз при 503
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      if (status === 503 && i < retries) {
        console.warn(`503, retrying ${i+1}/${retries}…`);
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;

  // 1) Основная: DialoGPT-small
  try {
    const dRes = await withRetry(() =>
      axios.post(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-small',
        { inputs: message },
        { headers: HEADERS, timeout: TIMEOUT }
      )
    );
    const dReply = dRes.data[0]?.generated_text?.trim();
    if (dReply) {
      return res.json({ reply: dReply });
    }
  } catch (err) {
    console.warn('DialoGPT-small failed:', err.response?.status);
  }

  // 2) Фоллбэк: Flan-T5-small
  try {
    const fRes = await withRetry(() =>
      axios.post(
        'https://api-inference.huggingface.co/models/google/flan-t5-small',
        {
          inputs: `You are a helpful assistant.\nUser: ${message}\nAssistant:`,
          parameters: { temperature: 0.3, top_p: 0.9, max_new_tokens: 100 }
        },
        { headers: HEADERS, timeout: TIMEOUT }
      )
    );
    const fReply = fRes.data[0]?.generated_text?.trim();
    if (fReply) {
      return res.json({ reply: fReply });
    }
  } catch (err) {
    console.warn('Flan-T5-small failed:', err.response?.status);
  }

  // 3) Если обе модели упали — понятный ответ
  return res.json({
    reply: 'К сожалению, сейчас сервис перегружен. Попробуйте чуть позже.'
  });
});

export default router;
