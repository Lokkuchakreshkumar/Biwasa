import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const execPromise = util.promisify(exec);
const envPath = path.join(process.cwd(), '.env');

function getChromeProfile() {
  try {
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf8');
    let profile = '';
    content.split('\n').forEach(line => {
      const match = line.match(/^CHROME_PROFILE=(.*)$/);
      if (match) {
        profile = match[1].trim();
      }
    });
    return profile;
  } catch {
    return '';
  }
}

function getPythonCommand() {
  const venvPythonPath = path.join(process.cwd(), 'venv', 'bin', 'python');
  const venvPython3Path = path.join(process.cwd(), 'venv', 'bin', 'python3');
  
  if (fs.existsSync(venvPythonPath)) return venvPythonPath;
  if (fs.existsSync(venvPython3Path)) return venvPython3Path;
  return 'python3';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const prompt = body.prompt;
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const page = body.page || 1;
    const title = body.title || 'manga-maker';
    const chromeProfile = body.chromeProfile || getChromeProfile();

    const pythonCmd = getPythonCommand();
    let cmd = `"${pythonCmd}" scrapling_chatgpt.py --prompt "${prompt.replace(/"/g, '\\"')}" --output-dir public/generated --page ${page} --title "${title.replace(/"/g, '\\"')}"`;
    if (chromeProfile) {
      cmd += ` --chrome-profile "${chromeProfile.replace(/"/g, '\\"')}"`;
    }

    const { stdout } = await execPromise(cmd);
    const urlMatch = stdout.trim().split('\n').filter(line => line.startsWith('/generated/')).pop();

    return NextResponse.json({
      image_url: urlMatch,
      image_model: 'chatgpt-scraper',
      size: 'auto',
      quality: 'auto'
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Scraping failed' }, { status: 500 });
  }
}
