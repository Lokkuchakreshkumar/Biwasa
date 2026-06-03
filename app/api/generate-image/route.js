import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const envPath = path.join(process.cwd(), '.env');

function getOpenaiKey() {
  try {
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf8');
    let key = '';
    content.split('\n').forEach(line => {
      const match = line.match(/^OPENAI_API_KEY=(.*)$/);
      if (match) {
        key = match[1].trim();
      }
    });
    return key;
  } catch {
    return '';
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const openaiKey = body.openaiApiKey || getOpenaiKey();
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API Key required' }, { status: 400 });
    }

    const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: body.imageModel || 'dall-e-3',
        prompt: body.prompt,
        n: 1,
        size: body.size || '1024x1792',
        quality: body.quality || 'standard'
      })
    });

    const oaiData = await oaiRes.json();
    if (!oaiRes.ok) {
      throw new Error(oaiData.error?.message || 'OpenAI API Error');
    }

    return NextResponse.json({
      image_url: oaiData.data[0].url,
      image_model: body.imageModel || 'dall-e-3',
      size: body.size || '1024x1792',
      quality: body.quality || 'standard'
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
