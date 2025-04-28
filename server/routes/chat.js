import { Router } from 'express';
import axios from 'axios';

const router = Router();
const HEADERS = {
  Authorization: `Bearer ${process.env.HF_TOKEN}`,
  'Content-Type': 'application/json'
};
const TIMEOUT = 60000;

async function withRetry(fn, attempts = 2) {
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 503 && i < attempts) {
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
    const stableRes = await withRetry(() =>
      axios.post(
        'https://api-inference.huggingface.co/pipeline/chat/stabilityai/stablelm-base-alpha-3b',
        {
          inputs: [
            { role: 'system', content: 'You are a helpful, friendly assistant.' },
            { role: 'user',   content: message }
          ]
        },
        { headers: HEADERS, timeout: TIMEOUT }
      )
    );
    const reply = stableRes.data.generated_text?.trim();
    if (reply) {
      return res.json({ reply });
    }
  } catch (err) {
    console.warn('StableLM chat failed:', err.response?.status);
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
        { headers: HEADERS, timeout: TIMEOUT }
      )
    );
    const reply2 = bbRes.data.generated_text?.trim();
    if (reply2) {
      return res.json({ reply: reply2 });
    }
  } catch (err) {
    console.error('BlenderBot fallback failed:', err.response?.status);
  }

  return res.json({
    reply: 'К сожалению, сейчас все модели перегружены. Попробуйте чуть позже.'
  });
});

export default router;
