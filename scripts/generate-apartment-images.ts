import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const apartments = [
  {
    name: 'luxury-cairo',
    prompt: 'Modern luxury apartment living room in New Cairo Egypt, floor-to-ceiling windows with city view, contemporary furniture, marble floors, warm lighting, real estate photography'
  },
  {
    name: 'villa-mohandessin',
    prompt: 'Spacious villa interior in Mohandessin Cairo, open plan living area, modern Egyptian design, elegant furniture, natural sunlight, high-end finishes, architectural photography'
  },
  {
    name: 'studio-maadi',
    prompt: 'Cozy modern studio apartment in Maadi Cairo, smart space utilization, minimalist design, large windows with garden view, neutral colors, professional real estate photo'
  },
  {
    name: 'seaview-alexandria',
    prompt: 'Beachfront apartment with Mediterranean sea view in Alexandria Egypt, bright living room, balcony overlooking the sea, white and blue decor, natural light, vacation home style'
  },
  {
    name: 'duplex-october',
    prompt: 'Modern duplex apartment in 6th of October City, double height ceiling, contemporary staircase, open kitchen, family room, modern Egyptian interior design, architectural photography'
  },
  {
    name: 'penthouse-zamalek',
    prompt: 'Luxurious penthouse terrace in Zamalek Cairo, rooftop garden, Nile river view, outdoor seating area, modern landscaping, sunset ambiance, premium real estate photography'
  },
  {
    name: 'family-apartment',
    prompt: 'Family-friendly apartment interior, comfortable living room with sofa set, dining area, warm colors, children-safe design, modern Egyptian home, natural lighting'
  },
  {
    name: 'modern-kitchen',
    prompt: 'Modern open kitchen in Egyptian apartment, white cabinets, marble countertops, breakfast bar, stainless steel appliances, contemporary design, real estate photography'
  }
];

async function generateImages() {
  console.log('🏠 Generating apartment images...\n');
  
  const zai = await ZAI.create();
  const outputDir = path.join(process.cwd(), 'public', 'apartments');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const apt of apartments) {
    try {
      console.log(`📸 Generating: ${apt.name}...`);
      
      const response = await zai.images.generations.create({
        prompt: apt.prompt,
        size: '1344x768'
      });

      const imageBase64 = response.data[0].base64;
      const buffer = Buffer.from(imageBase64, 'base64');
      const filepath = path.join(outputDir, `${apt.name}.png`);
      
      fs.writeFileSync(filepath, buffer);
      console.log(`   ✅ Saved: ${filepath}\n`);
    } catch (error) {
      console.error(`   ❌ Failed: ${apt.name}`, error);
    }
  }

  console.log('🎉 Image generation complete!');
}

generateImages().catch(console.error);
