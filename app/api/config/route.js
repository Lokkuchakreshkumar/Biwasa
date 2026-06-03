import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const envPath = path.join(process.cwd(), '.env');

function readEnv() {
  try {
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const config = {};
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        config[match[1].trim()] = match[2].trim();
      }
    });
    return config;
  } catch {
    return {};
  }
}

function saveEnv(keys) {
  const current = readEnv();
  const merged = { ...current, ...keys };
  const content = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  fs.writeFileSync(envPath, content, 'utf8');
}

export async function GET() {
  const env = readEnv();
  return NextResponse.json({
    groqApiKey: env.GROQ_API_KEY || '',
    openaiApiKey: env.OPENAI_API_KEY || '',
    chromeProfile: env.CHROME_PROFILE || ''
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    saveEnv({
      GROQ_API_KEY: body.groqApiKey || '',
      OPENAI_API_KEY: body.openaiApiKey || '',
      CHROME_PROFILE: body.chromeProfile || ''
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
