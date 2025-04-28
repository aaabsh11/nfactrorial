import { Router } from 'express';
import axios from 'axios';

const router = Router();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  const prompt =
    "You are a helpful assistant. Answer concisely.\n\nUser: " +
    message +
    "\nAssistant:";

 async function queryWithRetries(url, body, options, retries = 3) {
   for (let i = 0; i < retries; i++) {
     try {
       return await axios.post(url, body, options);
     } catch (err) {
       const status = err.response?.status
       if (status === 503 && i < retries - 1) {
         console.warn(`503, retrying in 1s (attempt ${i+1}/${retries})`);
         await sleep(1000);
         continue;
       }
       throw err;
     }
   }
 }

  try {
    const hfRes = await queryWithRetries(
      'https://api-inference.huggingface.co/models/google/flan-t5-small',
     {
       inputs: prompt,
       parameters: {
         temperature: 0.3,
         top_p: 0.9,
         max_new_tokens: 100
       }
     },
     {
       headers: {
         Authorization: `Bearer ${process.env.HF_TOKEN}`,
         'Content-Type': 'application/json'
       },
       timeout: 60000
     }
   );

   const reply = hfRes.data[0]?.generated_text?.trim() || '';
   return res.json({ reply });

  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data || err.message;
    console.error('HuggingFace final error', { status, data });

   if (status === 503) {
     return res.json({
       reply:
         'Unfortunately, the service is currently overloaded. Please try again in a minute.'
     });
   }

    return res.status(500).json({ error: 'AI service error' });
  }
});

export default router;
