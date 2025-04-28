import { Router } from 'express';
import axios from 'axios';

const router = Router();

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  throw new Error('HF_TOKEN не задан. Установите его в .env');
}

const PIPELINE_URL =
  'https://api-inference.huggingface.co/pipeline/conversational/microsoft/DialoGPT-small';
const HEADERS = {
  Authorization: `Bearer ${HF_TOKEN}`,
  'Content-Type': 'application/json',
  'x-wait-for-model': 'true'   
};
const TIMEOUT = 60000;

async function queryWithRetry(body, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.post(PIPELINE_URL, body, {
        headers: HEADERS,
        timeout: TIMEOUT
      });
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
  if (!message) return res.status(400).json({ error: 'message required' });

  const body = {
    inputs: {
      past_user_inputs: [],        
      generated_responses: [],     
      text: message                
    }
  };

  try {
    const hfRes = await queryWithRetry(body);
    const reply = hfRes.data[0]?.generated_text?.trim();
    if (reply) {
      return res.json({ reply });
    } else {
      throw new Error('empty reply');
    }
  } catch (err) {
    console.error('HuggingFace error', err.response?.status, err.response?.data || err.message);
 
    return res.json({
      reply: 'Sorry, the service is temporarily unavailable. Try again later.'
    });
  }
});

export default router;
