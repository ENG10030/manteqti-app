import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Ensure generated images directory exists
const outputDir = path.join(process.cwd(), 'public', 'generated-images');

function ensureOutputDir() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '1344x768' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const validSizes = ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864', '1440x720', '720x1440'];
    if (!validSizes.includes(size)) {
      return NextResponse.json({ error: `Invalid size. Use one of: ${validSizes.join(', ')}` }, { status: 400 });
    }

    ensureOutputDir();
    const zai = await getZAI();

    // Enhance prompt for apartment images
    const enhancedPrompt = `${prompt}, professional real estate photography, bright and airy, modern interior design, high quality, detailed, 4k`;

    const response = await zai.images.generations.create({
      prompt: enhancedPrompt,
      size: size as '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440'
    });

    const imageBase64 = response.data[0].base64;
    const buffer = Buffer.from(imageBase64, 'base64');

    const filename = `apartment_${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      success: true,
      imageUrl: `/generated-images/${filename}`,
      prompt: enhancedPrompt,
      size: size
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image'
    }, { status: 500 });
  }
}
