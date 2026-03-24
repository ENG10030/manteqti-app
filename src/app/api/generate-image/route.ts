import { NextRequest, NextResponse } from 'next/server';

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
  'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&q=80',
  'https://images.unsplash.com/photo-1560185008-b033106af5c3?w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'
];

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

    const randomIndex = Math.floor(Math.random() * PLACEHOLDER_IMAGES.length);
    const placeholderUrl = PLACEHOLDER_IMAGES[randomIndex];
    
    return NextResponse.json({
      success: true,
      imageUrl: placeholderUrl,
      prompt: prompt,
      size: size,
      fallback: true,
      message: 'AI image generation not available in production.'
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to generate image'
    }, { status: 500 });
  }
}