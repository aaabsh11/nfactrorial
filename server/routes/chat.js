import { Router } from 'express';
import axios from 'axios';

const router = Router();
const HF_OPTIONS = {
  headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
  timeout: 60000
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function queryWithRetries(url, body, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await axios.post(url, body, HF_OPTIONS); }
    catch (err) {
      if (err.response?.status === 503 && i < retries) {
        await sleep(1000);
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;

  try {
    const hfRes = await queryWithRetries(
      'https://api-inference.huggingface.co/pipeline/chat/google/flan-t5-base',
      {
        inputs: [
          { role: 'system',  content: 'You are a helpful, friendly assistant.' },
          { role: 'user',    content: message }
        ]
      }
    );
    const reply = hfRes.data.generated_text?.trim();
    if (reply) return res.json({ reply });
  } catch (err) {
    console.warn('flan-t5-base failed:', err.response?.status);
  }

  try {
    const hfRes2 = await queryWithRetries(
      'https://api-inference.huggingface.co/pipeline/chat/stabilityai/stablelm-base-alpha-3b',
      {
        inputs: [
          { role: 'system', content: 'You are a helpful, friendly assistant.' },
          { role: 'user',   content: message }
        ]
      }
    );
    const reply2 = hfRes2.data.generated_text?.trim();
    if (reply2) return res.json({ reply: reply2 });
  } catch (err) {
    console.error('stablelm-base-alpha-3b failed:', err.response?.status);
  }

  return res.json({
    reply: 'Unfortunately, the service is currently overloaded - please try again later.'
  });
});

export default router;
