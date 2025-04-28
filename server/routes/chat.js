import { Router } from 'express';
import axios from 'axios';

const router = Router();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queryWithRetries(url, body, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.post(url, body, options);
    } catch (err) {
      const status = err.response?.status;
      if (status === 503 && i < retries) {
        console.warn(`Retry ${i + 1}/${retries} for ${url}`);
        await sleep(1000);
        continue;
      }
      throw err;
    }
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;

  const hfOptions = {
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  };

  const flanUrl = 'https://api-inference.huggingface.co/models/google/flan-t5-small';
  const prompt = `You are a helpful assistant. Answer concisely.\n\nUser: ${message}\nAssistant:`;

  try {
    const hfRes = await queryWithRetries(
      flanUrl,
      { inputs: prompt, parameters: { temperature: 0.3, top_p: 0.9, max_new_tokens: 100 } },
      hfOptions
    );
    const reply = hfRes.data[0]?.generated_text?.trim() || '';
    return res.json({ reply });

  } catch (err1) {
    console.warn('flan-t5-small failed:', err1.response?.status);

    const dfdUrl = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-small';
    try {
      const hfRes2 = await queryWithRetries(
        dfdUrl,
        { inputs: message },
        hfOptions
      );
      const reply2 = hfRes2.data[0]?.generated_text?.trim() || '';
      return res.json({ reply: reply2 });
    } catch (err2) {
      console.error('DialoGPT-small failed:', err2.response?.status);

      return res.json({
        reply: 'Unfortunately, the service is currently overloaded. Try again later.'
      });
    }
  }
});

export default router;
