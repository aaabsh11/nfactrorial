import { Router } from 'express';
import axios from 'axios';

const router = Router();
const HF_TOKEN = process.env.HF_TOKEN;
const HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  'Content-Type': 'application/json'
};
const TIMEOUT = 60000;

async function queryWithRetries(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 503 && i < retries) {
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
    "You are a helpful assistant. Answer the user clearly and concisely.\n\nUser: " +
    message +
    "\nAssistant:";

  try {
    const hfRes = await queryWithRetries(() =>
      axios.post(
        'https://api-inference.huggingface.co/models/google/flan-t5-base',
        {
          inputs: prompt,
          parameters: { temperature: 0.3, top_p: 0.9, max_new_tokens: 150 }
        },
        { headers: HEADERS, timeout: TIMEOUT }
      )
    );
    const reply =
      hfRes.data.generated_text ||
      hfRes.data[0]?.generated_text ||
      '';
    if (reply) return res.json({ reply: reply.trim() });
  } catch (err) {
    console.warn('flan-t5-base failed:', err.response?.status);
  }

  try {
    const hfRes2 = await queryWithRetries(() =>
      axios.post(
        'https://api-inference.huggingface.co/pipeline/chat/facebook/blenderbot-400M-distill',
        {
          inputs: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: message }
          ]
        },
        { headers: HEADERS, timeout: TIMEOUT }
      )
    );
    const reply2 = hfRes2.data.generated_text || '';
    if (reply2) return res.json({ reply: reply2.trim() });
  } catch (err) {
    console.error('BlenderBot fallback failed:', err.response?.status);
  }

  return res.json({
    reply: 'Sorry, the service is currently unavailable. Please try again later.'
  });
});

export default router;
