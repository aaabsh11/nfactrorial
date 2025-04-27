import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.post('/', async (req, res) => {
  const { message } = req.body;

  const prompt =
    "You are a helpful, friendly AI assistant. Answer the user clearly and concisely.\n\n" +
    "User: " + message + "\nAssistant:";

  try {
   const hfRes = await axios.post(
     'https://api-inference.huggingface.co/models/bigscience/bloomz-560m',
     {
       inputs: prompt,
       parameters: {
         temperature: 0.3,
         top_p: 0.9,
         max_new_tokens: 150
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

    const text = hfRes.data[0]?.generated_text?.trim() || '';
    return res.json({ reply: text });

  } catch (err) {
    console.error('HuggingFace error', {
      status: err.response?.status,
      data: err.response?.data || err.message
    });
    return res.status(500).json({ error: 'AI service error' });
  }
});

export default router;
