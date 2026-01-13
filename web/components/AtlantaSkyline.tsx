export default function AtlantaSkyline() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sunset gradient background */}
      <div className="absolute inset-0 sunset-bg" />

      {/* Sun */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[15%] w-32 h-32 md:w-48 md:h-48">
        <div className="w-full h-full rounded-full bg-gradient-to-b from-yellow-300 via-orange-400 to-orange-500 opacity-90 blur-sm" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-b from-yellow-200 to-orange-300" />
      </div>

      {/* Stylized Atlanta Skyline SVG */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-[45%] md:h-[55%]"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background buildings - darkest */}
        <g fill="#1a1635" opacity="0.6">
          <rect x="50" y="200" width="40" height="200" />
          <rect x="100" y="180" width="50" height="220" />
          <rect x="170" y="220" width="35" height="180" />
          <rect x="980" y="190" width="45" height="210" />
          <rect x="1040" y="210" width="55" height="190" />
          <rect x="1110" y="230" width="40" height="170" />
        </g>

        {/* Mid buildings */}
        <g fill="#251f4a">
          {/* Left side */}
          <rect x="220" y="150" width="60" height="250" />
          <rect x="290" y="120" width="45" height="280" />

          {/* Right side */}
          <rect x="850" y="140" width="55" height="260" />
          <rect x="920" y="160" width="50" height="240" />
        </g>

        {/* Main skyline - iconic buildings */}
        <g fill="#2d2657">
          {/* Bank of America Plaza - tallest, distinctive spire */}
          <path d="M500 50 L520 50 L520 80 L530 80 L530 400 L490 400 L490 80 L500 80 Z" />
          <polygon points="510,50 500,20 520,20" fill="#3d3670" />

          {/* Westin Peachtree Plaza - cylindrical tower */}
          <ellipse cx="600" cy="400" rx="45" ry="15" />
          <rect x="555" y="90" width="90" height="310" rx="45" />
          <ellipse cx="600" cy="90" rx="45" ry="15" fill="#3d3670" />

          {/* 191 Peachtree - distinctive top */}
          <rect x="680" y="100" width="70" height="300" />
          <polygon points="680,100 715,60 750,100" fill="#3d3670" />

          {/* SunTrust Plaza */}
          <rect x="400" y="130" width="65" height="270" />
          <rect x="410" y="115" width="45" height="15" fill="#3d3670" />

          {/* Georgia-Pacific Tower */}
          <rect x="760" y="150" width="55" height="250" />

          {/* Promenade buildings */}
          <rect x="350" y="180" width="40" height="220" />
          <rect x="830" y="170" width="45" height="230" />
        </g>

        {/* Foreground buildings - darkest silhouette */}
        <g fill="#1E1B4B">
          <rect x="0" y="320" width="1200" height="80" />
          <rect x="150" y="280" width="80" height="120" />
          <rect x="250" y="300" width="60" height="100" />
          <rect x="900" y="290" width="70" height="110" />
          <rect x="1000" y="310" width="90" height="90" />
        </g>

        {/* Window lights - subtle glow effect */}
        <g fill="#FFD93D" opacity="0.3">
          {/* Bank of America windows */}
          <rect x="502" y="100" width="3" height="280" />
          <rect x="512" y="100" width="3" height="280" />

          {/* Westin windows */}
          <rect x="580" y="110" width="2" height="270" />
          <rect x="595" y="110" width="2" height="270" />
          <rect x="610" y="110" width="2" height="270" />

          {/* 191 Peachtree windows */}
          <rect x="695" y="120" width="3" height="260" />
          <rect x="720" y="120" width="3" height="260" />

          {/* Other building lights */}
          <rect x="420" y="150" width="2" height="220" />
          <rect x="440" y="150" width="2" height="220" />
          <rect x="775" y="170" width="2" height="210" />
        </g>
      </svg>

      {/* Gradient fade at bottom for content blend */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#1E1B4B] to-transparent" />
    </div>
  );
}
