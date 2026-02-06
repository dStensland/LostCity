import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        tw="relative w-full h-full flex flex-col items-center justify-center bg-[linear-gradient(135deg,_#0a0a0f_0%,_#1a1a2e_50%,_#16213e_100%)] font-sans"
      >
        {/* Ambient glow effect */}
        <div
          tw="absolute top-[20%] left-[30%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,_rgba(255,107,107,0.15)_0%,_transparent_70%)]"
        />
        <div
          tw="absolute bottom-[20%] right-[20%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,_rgba(0,255,255,0.1)_0%,_transparent_70%)]"
        />

        {/* Logo text */}
        <div tw="flex flex-col items-center gap-4">
          <div
            tw="text-[72px] font-bold text-[#fff5eb] tracking-[-2px] drop-shadow-[0_0_40px_rgba(255,107,107,0.5)]"
          >
            Lost City
          </div>
          <div tw="text-[28px] text-[#9ca3af] tracking-[4px] uppercase">
            Discover Local Events
          </div>
        </div>

        {/* Bottom tagline */}
        <div tw="absolute bottom-[48px] flex items-center gap-2 text-[#6b7280] text-[18px]">
          <span>AI-powered event discovery</span>
          <span tw="text-[#ff6b6b]">•</span>
          <span>450+ sources</span>
          <span tw="text-[#ff6b6b]">•</span>
          <span>Atlanta</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
