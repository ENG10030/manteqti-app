import { NextRequest, NextResponse } from 'next/server';

// Check if we're in development environment with SDK available
let ZAI_AVAILABLE = false;

async function getZAI() {
  try {
    // Dynamic import to avoid build errors when SDK is not available
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    ZAI_AVAILABLE = true;
    return await ZAI.create();
  } catch (e) {
    console.log('ZAI SDK not available for image generation');
    ZAI_AVAILABLE = false;
    return null;
  }
}

// Placeholder image URLs for fallback (professional real estate images from Unsplash)
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

    // Try to use AI SDK
    try {
      const zai = await getZAI();

      if (!zai || !ZAI_AVAILABLE) {
        // Use placeholder image when SDK is not available
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_IMAGES.length);
        const placeholderUrl = PLACEHOLDER_IMAGES[randomIndex];
        
        return NextResponse.json({
          success: true,
          imageUrl: placeholderUrl,
          prompt: prompt,
          size: size,
          fallback: true,
          message: 'AI image generation not available in production. Using placeholder image.'
        });
      }

      // Enhance prompt for apartment images
      const enhancedPrompt = `${prompt}, professional real estate photography, bright and airy, modern interior design, high quality, detailed, 4k`;

      const response = await zai.images.generations.create({
        prompt: enhancedPrompt,
        size: size as '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440'
      });

      const imageBase64 = response.data[0].base64;
      
      // Return base64 image directly (can't write to filesystem in Vercel)
      return NextResponse.json({
        success: true,
        imageUrl: `data:image/png;base64,${imageBase64}`,
        prompt: enhancedPrompt,
        size: size
      });
    } catch (aiError) {
      console.error('AI image generation error, using fallback:', aiError);
      
      // Use placeholder image
      const randomIndex = Math.floor(Math.random() * PLACEHOLDER_IMAGES.length);
      const placeholderUrl = PLACEHOLDER_IMAGES[randomIndex];
      
      return NextResponse.json({
        success: true,
        imageUrl: placeholderUrl,
        prompt: prompt,
        size: size,
        fallback: true,
        message: 'AI image generation failed. Using placeholder image.'
      });
    }
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image'
    }, { status: 500 });
  }
}
