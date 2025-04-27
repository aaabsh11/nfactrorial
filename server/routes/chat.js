import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.post('/', async (req, res) => {
  const { message } = req.body;

  const userMsg = message;

  try {
    const hfRes = await axios.post(
      'https://api-inference.huggingface.co/pipeline/chat/stabilityai/stablelm-base-alpha-3b',
      {
        inputs: [
          { role: 'system',  content: 'You are a helpful assistant.' },
          { role: 'user',    content: userMsg }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const reply = (hfRes.data.generated_text || '').trim();
    return res.json({ reply });

  } catch (err) {
    console.error('HuggingFace error', {
      status: err.response?.status,
      data: err.response?.data || err.message
    });
    if (err.response?.status === 503) {
      return res.json({ reply: 'Сервис сейчас перегружен, попробуйте чуть позже.' });
    }
    return res.status(500).json({ error: 'AI service error' });
  }
});

export default router;
