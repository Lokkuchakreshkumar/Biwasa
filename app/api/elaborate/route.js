import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const envPath = path.join(process.cwd(), '.env');

function getGroqKey() {
  try {
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf8');
    let key = '';
    content.split('\n').forEach(line => {
      const match = line.match(/^GROQ_API_KEY=(.*)$/);
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
    const groqKey = body.groqApiKey || getGroqKey();
    if (!groqKey) {
      return NextResponse.json({ error: 'Groq API Key required' }, { status: 400 });
    }

    // Clear the active ChatGPT session so the new storyboard starts fresh
    const activeChatFile = path.join(process.cwd(), 'active_chat_url.txt');
    if (fs.existsSync(activeChatFile)) {
      try {
        fs.unlinkSync(activeChatFile);
      } catch (e) {
        console.error('Failed to delete active_chat_url.txt', e);
      }
    }

    const prompt = `You are an expert manga scriptwriter and storyboard artist. Given the story outline, elaborate it into a comprehensive, page-by-page manga production draft.

Requirements for each page draft:
1. **story**: Elaborate the narrative events and action descriptions occurring on this page.
2. **dialogues_in_this_page**: List the exact dialogue lines spoken by the characters on this page. If a scene has sound effects (e.g. "SHHHHKKK!"), include them as dialogue or text indicators.
3. **image_prompt**: Construct a highly-detailed, comprehensive image generation prompt (suitable for DALL-E 3) to draw a COMPLETE comic manga page for this storyboard segment.
   - The prompt MUST be self-contained and explicitly contain the core story events AND all dialogues for this page.
   - It MUST explain the core layout making it like a reference image: specify exactly how many panels there are, what is happening in each panel, camera angles, and character actions.
   - For each panel, describe the exact character positions and specify the speech bubbles containing the dialogue text (e.g., 'with a white speech bubble saying: "Character: line text"').
   - Include all text dialogues directly inside the prompt so the image generator knows what text to render in the speech bubbles!
   - Keep a consistent premium dark manga art style: "highly detailed black and white manga, expressive line art, screentones, dark dramatic shadows, cinematic lighting".

Input Outline details:
- Number of pages to output: ${body.pages || 5}
- Story idea: ${body.story || ''}
- Optional dialogues to include: ${body.dialogues || ''}
- Additional style / references: ${body.imageStyle || ''} ${body.references || ''}


Respond EXACTLY with a JSON object in this format:
{
  "title": "Manga title",
  "logline": "One sentence summary",
  "pages": [
    {
      "page": 1,
      "story": "Expanded story events...",
      "dialogues_in_this_page": ["Character: line"],
      "image_prompt": "Detailed image generation prompt describing panels, scenes, characters, and speech bubbles with text"
    }
  ]
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: body.model || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      throw new Error(groqData.error?.message || 'Groq API Error');
    }

    const content = JSON.parse(groqData.choices[0].message.content);
    return NextResponse.json(content);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
