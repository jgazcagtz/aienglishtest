
import { OpenAI } from 'openai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages } = req.body;
        
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: messages,
            temperature: 0.7,
            max_tokens: 300,
        });

        const reply = completion.choices[0].message.content;
        
        return res.status(200).json({ 
            reply: reply 
        });
    } catch (error) {
        console.error('OpenAI API error:', error);
        return res.status(500).json({ 
            error: 'Error processing your request',
            details: error.message 
        });
    }
}

export const config = {
    runtime: 'edge',
};
