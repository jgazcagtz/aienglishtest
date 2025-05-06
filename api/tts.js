import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'alloy' } = req.body;

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice, // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
    
  } catch (error) {
    console.error('OpenAI TTS error:', error);
    res.status(500).json({ 
      error: 'TTS generation failed',
      details: error.message 
    });
  }
}
