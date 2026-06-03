import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const execPromise = util.promisify(exec);

function getPythonCommand() {
  const venvPythonPath = path.join(process.cwd(), 'venv', 'bin', 'python');
  const venvPython3Path = path.join(process.cwd(), 'venv', 'bin', 'python3');
  
  if (fs.existsSync(venvPythonPath)) return venvPythonPath;
  if (fs.existsSync(venvPython3Path)) return venvPython3Path;
  return 'python3';
}

export async function GET() {
  try {
    const pythonCmd = getPythonCommand();
    await execPromise(`"${pythonCmd}" -c "import scrapling"`);
    return NextResponse.json({ available: true, version: "local" });
  } catch (e) {
    return NextResponse.json({ available: false });
  }
}
