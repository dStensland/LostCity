"use client";

export default function UserLocationDot() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Accuracy ring / pulse */}
      <div
        className="absolute w-[32px] h-[32px] rounded-full"
        style={{
          background: "rgba(56, 189, 248, 0.15)",
          animation: "userLocPulse 2s ease-in-out infinite",
        }}
      />
      {/* Core dot */}
      <div
        className="w-[14px] h-[14px] rounded-full border-[2.5px] border-white"
        style={{
          background: "#38BDF8",
          boxShadow: "0 0 8px #38BDF8, 0 0 16px rgba(56, 189, 248, 0.5)",
        }}
      />
    </div>
  );
}
