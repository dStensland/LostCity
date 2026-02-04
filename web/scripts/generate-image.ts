import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY not set. Add it to web/.env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let prompt = "";
  let outputName = "";
  let aspectRatio: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      outputName = args[++i];
    } else if (args[i] === "--aspect-ratio" && args[i + 1]) {
      aspectRatio = args[++i];
    } else {
      prompt = args[i];
    }
  }

  if (!prompt) {
    console.error("Usage: npx tsx scripts/generate-image.ts \"prompt\" [--output name] [--aspect-ratio 16:9]");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  console.log(`Generating image for: "${prompt}"`);
  if (aspectRatio) console.log(`Aspect ratio: ${aspectRatio}`);

  const config: Record<string, unknown> = { numberOfImages: 1 };
  if (aspectRatio) config.aspectRatio = aspectRatio;

  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config,
  });

  const outDir = path.join(process.cwd(), "generated-images");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let idx = 1;
  for (const generatedImage of response.generatedImages!) {
    const imgBytes = generatedImage.image!.imageBytes!;
    const buffer = Buffer.from(imgBytes, "base64");
    const filename = path.join(outDir, outputName ? `${outputName}.png` : `image-${Date.now()}-${idx}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`Saved: ${filename}`);
    idx++;
  }
}

main().catch(console.error);
