"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type Embed = "shadertoy" | "codepen" | "iframe" | "link-only";

interface InspirationItem {
  name: string;
  description: string;
  technique: string;
  tier: "jaw-dropper" | "premium" | "lightweight" | "exotic";
  embed: Embed;
  /** For shadertoy: the shader ID. For codepen: user/pen. For iframe: full URL */
  embedId: string;
  /** Static preview image URL */
  thumbnail: string;
  links: { label: string; url: string }[];
  tags: string[];
  performance: string;
  complexity: "low" | "medium" | "high";
}

/** Shadertoy preview thumbnails */
const st = (id: string) => `https://www.shadertoy.com/media/shaders/${id}.jpg`;
/** CodePen screenshot */
const cp = (userPen: string) => {
  const [user, pen] = userPen.split("/");
  return `https://shots.codepen.io/${user}/pen/${pen}-512.webp?version=2`;
};

const ITEMS: InspirationItem[] = [
  // ── Tier 1: Jaw-Droppers ──────────────────────────────────────────
  {
    name: "Domain Warping",
    description:
      "Swirling, painterly clouds like Jupiter's atmosphere or marble stone. Colors bleed in slow, hypnotic spirals. Best visual-richness-to-cost ratio of any shader technique.",
    technique: "fBM where input coords are warped by another fBM pass: f(p + fbm(p + fbm(p)))",
    tier: "jaw-dropper",
    embed: "shadertoy",
    embedId: "4s23zz",
    thumbnail: st("4s23zz"),
    links: [
      { label: "Inigo Quilez article", url: "https://iquilezles.org/articles/warp/" },
      { label: "Live demo (shader-web-background)", url: "https://xemantic.github.io/shader-web-background/demo/shadertoy-warping-procedural-2.html" },
    ],
    tags: ["shader", "noise", "single-pass", "organic"],
    performance: "Excellent. Single-pass fragment shader, no state.",
    complexity: "medium",
  },
  {
    name: "Navier-Stokes Fluid",
    description:
      "Neon ink in black water. Luminous swirling plumes with bloom. GPU-based Navier-Stokes solver. 16k GitHub stars, runs on mobile.",
    technique: "GPU fluid dynamics: advection, divergence, curl, vorticity, pressure solving. Double-buffered FBOs.",
    tier: "jaw-dropper",
    embed: "iframe",
    embedId: "https://paveldogreat.github.io/WebGL-Fluid-Simulation/",
    thumbnail: "https://repository-images.githubusercontent.com/152977498/24e20500-543c-11ea-8e01-81c1fa8e7534",
    links: [
      { label: "Live demo", url: "https://paveldogreat.github.io/WebGL-Fluid-Simulation/" },
      { label: "GitHub", url: "https://github.com/PavelDoGreat/WebGL-Fluid-Simulation" },
      { label: "Background fork", url: "https://github.com/tkabalin/WebGL-Fluid-Background" },
    ],
    tags: ["webgl", "fluid", "interactive", "mobile-friendly"],
    performance: "Runs 60fps on mobile phones. Background fork tuned for low overhead.",
    complexity: "medium",
  },
  {
    name: "Protean Clouds",
    description:
      "Slowly evolving volumetric cloudscapes with golden-hour lighting. Widely called 'the most mesmerizing shader on Shadertoy.'",
    technique: "Raymarching through 3D FBM noise, volumetric light scattering, multiple octaves",
    tier: "jaw-dropper",
    embed: "shadertoy",
    embedId: "3l23Rh",
    thumbnail: st("3l23Rh"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/3l23Rh" },
    ],
    tags: ["shader", "raymarching", "volumetric", "clouds"],
    performance: "High cost. Needs resolution scaling on mobile.",
    complexity: "high",
  },
  {
    name: "Star Nest",
    description:
      "Flying through a cosmic nebula with infinite parallax depth. Volumetric glow against deep space. Only ~40 lines of GLSL.",
    technique: "Iterative volumetric sampling of tiled 3D noise, additive light accumulation",
    tier: "jaw-dropper",
    embed: "shadertoy",
    embedId: "XlfGRj",
    thumbnail: st("XlfGRj"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/XlfGRj" },
    ],
    tags: ["shader", "space", "volumetric", "compact"],
    performance: "Low-moderate cost. Runs well on most GPUs.",
    complexity: "low",
  },
  {
    name: "Curl Noise Embers",
    description:
      "Dense clouds of glowing particles flowing in smooth vortices — embers in wind, bioluminescent plankton. Divergence-free flow guarantees no clumping.",
    technique: "Curl of 3D noise field produces divergence-free vectors. GPGPU via FBO ping-pong.",
    tier: "jaw-dropper",
    embed: "iframe",
    embedId: "https://al-ro.github.io/projects/embers/",
    thumbnail: "https://al-ro.github.io/projects/embers/embers.png",
    links: [
      { label: "Embers demo", url: "https://al-ro.github.io/projects/embers/" },
      { label: "1M particles (CodePen)", url: "https://codepen.io/greenleafone7/pen/MaRZOW" },
    ],
    tags: ["particles", "webgl", "curl-noise", "organic"],
    performance: "100k-1M particles at 60fps with GPGPU.",
    complexity: "medium",
  },
  {
    name: "Reaction-Diffusion",
    description:
      "Coral-like, lichen-like patterns that grow and morph. Spots split into stripes, stripes fork into branches. Nothing else looks like it.",
    technique: "Gray-Scott model: two chemicals diffusing at different rates. Ping-pong FBO per frame.",
    tier: "jaw-dropper",
    embed: "iframe",
    embedId: "https://jasonwebb.github.io/reaction-diffusion-playground/",
    thumbnail: "https://repository-images.githubusercontent.com/178523200/78a51680-8f18-11e9-87f1-01925e9ce69b",
    links: [
      { label: "Interactive playground", url: "https://jasonwebb.github.io/reaction-diffusion-playground/" },
      { label: "WebGL implementation", url: "https://github.com/piellardj/reaction-diffusion-webgl" },
    ],
    tags: ["simulation", "organic", "webgl", "biological"],
    performance: "GPU-bound. Half-res + upscale for full-screen.",
    complexity: "medium",
  },
  {
    name: "Strange Attractors",
    description:
      "Luminous 3D ribbon structures — Lorenz butterfly, Thomas knots, Aizawa torus. Additive blending makes dense regions glow.",
    technique: "ODE integration (Runge-Kutta 4), thousands of trajectory points, additive blending",
    tier: "jaw-dropper",
    embed: "iframe",
    embedId: "https://fusefactory.github.io/openfuse/strange%20attractors/particle%20system/Strange-Attractors-GPU/",
    thumbnail: "https://fusefactory.github.io/openfuse/images/strange_attractors/thomas_attractor.jpg",
    links: [
      { label: "GPU demo", url: "https://fusefactory.github.io/openfuse/strange%20attractors/particle%20system/Strange-Attractors-GPU/" },
      { label: "Three.js tutorial", url: "https://skywork.ai/blog/dancing-with-chaos-a-developers-guide-to-visualizing-strange-attractors-in-three-js/" },
    ],
    tags: ["math", "particles", "3D", "chaos"],
    performance: "Cheap math. 100k points with additive blending runs easily.",
    complexity: "medium",
  },

  // ── Tier 2: Premium & Proven ──────────────────────────────────────
  {
    name: "Stripe Mesh Gradient",
    description:
      "The famous Stripe.com living gradient — organic color blobs morphing like a lava lamp. ~10kb custom WebGL.",
    technique: "Custom fragment shaders with noise-based color interpolation, organic blob animation",
    tier: "premium",
    embed: "iframe",
    embedId: "https://whatamesh.vercel.app/",
    thumbnail: "https://repository-images.githubusercontent.com/494927559/8ab5697c-50f1-4e3d-a3ab-77854cdfc7d5",
    links: [
      { label: "Live recreation", url: "https://whatamesh.vercel.app/" },
      { label: "Tutorial", url: "https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/" },
      { label: "Codrops tutorial", url: "https://tympanus.net/codrops/2022/09/26/how-to-recreate-stripes-lava-lamp-gradient-with-three-js/" },
    ],
    tags: ["webgl", "gradient", "production-proven", "lightweight"],
    performance: "Designed as a page background. Very low GPU overhead.",
    complexity: "medium",
  },
  {
    name: "Seascape",
    description:
      "Fully procedural photorealistic ocean — waves, foam, horizon, sky. Zero textures. Raymarched sine-wave heightfield.",
    technique: "Raymarching against procedural heightfield, Fresnel reflections, procedural sky",
    tier: "premium",
    embed: "shadertoy",
    embedId: "Ms2SD1",
    thumbnail: st("Ms2SD1"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/Ms2SD1" },
    ],
    tags: ["shader", "raymarching", "water", "photorealistic"],
    performance: "Moderate-high. Single pass but dense math.",
    complexity: "high",
  },
  {
    name: "Water Caustics",
    description:
      "Shimmering pool-bottom caustic light patterns. Tiles seamlessly, extremely performant, simple math.",
    technique: "Layered cosine/sine wave interference patterns",
    tier: "premium",
    embed: "shadertoy",
    embedId: "MdlXz8",
    thumbnail: st("MdlXz8"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/MdlXz8" },
    ],
    tags: ["shader", "water", "tileable", "subtle"],
    performance: "Extremely performant. One of the cheapest stunning effects.",
    complexity: "low",
  },
  {
    name: "Creation by Silexars",
    description:
      "Expanding psychedelic rings with chromatic aberration. Only 19 lines of GLSL. Hypnotic and trivial to implement.",
    technique: "Radial sine patterns with RGB channel time-offset, coordinate distortion",
    tier: "premium",
    embed: "shadertoy",
    embedId: "XsXXDn",
    thumbnail: st("XsXXDn"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/XsXXDn" },
    ],
    tags: ["shader", "compact", "psychedelic", "19-lines"],
    performance: "Trivially cheap. Perfect background effect.",
    complexity: "low",
  },
  {
    name: "The Universe Within",
    description:
      "Psychedelic flythrough of neural/cosmic networks — branching, glowing pathways. 'The best experience I've had in a while, pure greatness.'",
    technique: "Raymarching through procedural volumetric structures, additive glow",
    tier: "premium",
    embed: "shadertoy",
    embedId: "lscczl",
    thumbnail: st("lscczl"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/lscczl" },
    ],
    tags: ["shader", "raymarching", "neural", "cosmic"],
    performance: "Moderate-high. Needs resolution scaling on mobile.",
    complexity: "high",
  },
  {
    name: "Tendrils",
    description:
      "Thousands of luminous particles self-organizing into jellyfish-tentacle / neural-network structures via recursive feedback.",
    technique: "GPGPU particles write velocity into shared texture, read back next frame. Emergent fluid structures.",
    tier: "premium",
    embed: "link-only",
    embedId: "",
    thumbnail: "https://repository-images.githubusercontent.com/64827498/a49d3180-46a0-11ea-8650-3e5b38a10351",
    links: [
      { label: "GitHub", url: "https://github.com/keeffEoghan/tendrils" },
    ],
    tags: ["particles", "emergent", "gpgpu", "audio-reactive"],
    performance: "GPU-bound GPGPU. Thousands of particles run smoothly.",
    complexity: "high",
  },
  {
    name: "Auroras (nimitz)",
    description:
      "Volumetric aurora borealis — green/purple light curtains rippling across a night sky. 'More authentic than many offline attempts.'",
    technique: "Volumetric raymarching with procedural trail generation, atmospheric scattering",
    tier: "premium",
    embed: "shadertoy",
    embedId: "XtGGRt",
    thumbnail: st("XtGGRt"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/XtGGRt" },
    ],
    tags: ["shader", "raymarching", "aurora", "atmospheric"],
    performance: "Moderate-high. Volumetric loop with polynomial sampling.",
    complexity: "high",
  },
  {
    name: "Rain on Glass",
    description:
      "Procedural rain droplets running down a window pane with realistic refraction and streaking. From a 64KB demo.",
    technique: "Procedural rain drop sim using layered noise and SDF circles, refraction distortion",
    tier: "premium",
    embed: "shadertoy",
    embedId: "ldfyzl",
    thumbnail: st("ldfyzl"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/ldfyzl" },
    ],
    tags: ["shader", "rain", "refraction", "atmospheric"],
    performance: "Moderate. Single-pass but needs a background texture for full effect.",
    complexity: "medium",
  },
  {
    name: "Flame (iq)",
    description:
      "A single realistic procedural flame — flickering, organic, orange-to-yellow with ember particles.",
    technique: "FBM noise scrolled over time, masked against gradient shape, abs() noise for wispy detail",
    tier: "premium",
    embed: "shadertoy",
    embedId: "MdX3zr",
    thumbnail: st("MdX3zr"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/MdX3zr" },
    ],
    tags: ["shader", "fire", "fbm", "compact"],
    performance: "Low cost. Simple fragment shader.",
    complexity: "low",
  },

  // ── Tier 3: Lightweight / CSS-Compatible ──────────────────────────
  {
    name: "Animated Film Grain",
    description:
      "Subtle shifting noise texture overlaid on the entire page. Instant cinematic quality on any dark theme. Pure CSS, sub-2kb.",
    technique: "::after pseudo-element with tiny noise PNG, CSS keyframe transform shift",
    tier: "lightweight",
    embed: "codepen",
    embedId: "ooblek/vYxYomx",
    thumbnail: cp("ooblek/vYxYomx"),
    links: [
      { label: "CodePen", url: "https://codepen.io/ooblek/pen/vYxYomx" },
      { label: "CSS-Tricks technique", url: "https://css-tricks.com/snippets/css/animated-grainy-texture/" },
    ],
    tags: ["css", "texture", "overlay", "cinematic"],
    performance: "Near-zero cost. Sub-2kb PNG + CSS animation.",
    complexity: "low",
  },
  {
    name: "Grainy Gradients",
    description:
      "Smooth gradients with organic film-grain texture. Risograph / analog photography feel. No JS runtime.",
    technique: "SVG feTurbulence noise layered under CSS gradients, contrast/brightness filter amplification",
    tier: "lightweight",
    embed: "iframe",
    embedId: "https://grainy-gradients.vercel.app/",
    thumbnail: "https://css-tricks.com/wp-content/uploads/2021/09/grainy-gradient-1.jpg",
    links: [
      { label: "Interactive playground", url: "https://grainy-gradients.vercel.app/" },
      { label: "CSS-Tricks article", url: "https://css-tricks.com/grainy-gradients/" },
    ],
    tags: ["css", "svg", "gradient", "analog"],
    performance: "Very good. CSS technique, no JS runtime cost.",
    complexity: "low",
  },
  {
    name: "CSS Aurora Borealis",
    description:
      "Colored bands of light sweeping across a dark background. Zero JS, dead simple, easily themed.",
    technique: "Multiple divs with large CSS gradients, box-shadows, blur, mix-blend-mode, keyframe animation",
    tier: "lightweight",
    embed: "codepen",
    embedId: "ostylowany/vYzPVZL",
    thumbnail: cp("ostylowany/vYzPVZL"),
    links: [
      { label: "CodePen", url: "https://codepen.io/ostylowany/pen/vYzPVZL" },
      { label: "Auroral library", url: "https://github.com/LunarLogic/auroral" },
    ],
    tags: ["css", "aurora", "zero-js", "themeable"],
    performance: "Excellent. Pure CSS, extremely lightweight.",
    complexity: "low",
  },
  {
    name: "CSS Bokeh",
    description:
      "Soft, out-of-focus light spots drifting across a dark background — city lights through a rain-streaked window.",
    technique: "CSS pseudo-elements with large border-radius, radial gradients, low opacity, keyframe transforms",
    tier: "lightweight",
    embed: "codepen",
    embedId: "Mamboleoo/BxMQYQ",
    thumbnail: cp("Mamboleoo/BxMQYQ"),
    links: [
      { label: "CodePen", url: "https://codepen.io/Mamboleoo/pen/BxMQYQ" },
    ],
    tags: ["css", "bokeh", "atmospheric", "dark-theme"],
    performance: "Near-zero. Pure CSS, no JS.",
    complexity: "low",
  },
  {
    name: "SVG Gooey Metaballs",
    description:
      "HTML elements merge like viscous blobs when overlapping. Three SVG filter primitives, no canvas.",
    technique: "feGaussianBlur + feColorMatrix (alpha contrast) + feComposite",
    tier: "lightweight",
    embed: "link-only",
    embedId: "",
    thumbnail: "https://codropspz-tympanus.netdna-ssl.com/codrops/wp-content/uploads/2015/03/CreativeGooeyEffects_01.jpg",
    links: [
      { label: "Codrops article", url: "https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/" },
      { label: "Demo", url: "http://tympanus.net/Development/CreativeGooeyEffects/" },
    ],
    tags: ["svg", "filter", "gooey", "interactive"],
    performance: "Good for targeted elements. Not full-page.",
    complexity: "low",
  },
  {
    name: "Bayer Dithering",
    description:
      "Retro-futuristic ordered-dot patterns over gradients. Lo-fi screen print aesthetic. Cheapest possible fragment shader.",
    technique: "Bayer matrix dithering in a fragment shader quantizes colors into a limited palette",
    tier: "lightweight",
    embed: "link-only",
    embedId: "",
    thumbnail: "https://tympanus.net/codrops/wp-content/uploads/2025/07/BayerDithering_featured.jpg",
    links: [
      { label: "Codrops tutorial", url: "https://tympanus.net/codrops/2025/07/30/interactive-webgl-backgrounds-a-quick-guide-to-bayer-dithering/" },
    ],
    tags: ["shader", "retro", "dithering", "minimal"],
    performance: "One of the cheapest effects possible.",
    complexity: "low",
  },

  // ── Tier 4: Exotic / Experimental ─────────────────────────────────
  {
    name: "Particle Life (WebGPU)",
    description:
      "Hundreds of thousands of colored particles self-organizing into swarming, orbiting alien protozoa. Deeply organic.",
    technique: "N-body simulation with per-species attraction/repulsion rules. WebGPU compute shaders.",
    tier: "exotic",
    embed: "link-only",
    embedId: "",
    thumbnail: "https://lisyarus.github.io/blog/media/particle_life_cover.png",
    links: [
      { label: "Live demo", url: "https://lisyarus.github.io/webgpu/particle-life.html" },
      { label: "Blog post", url: "https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html" },
    ],
    tags: ["webgpu", "simulation", "emergent", "experimental"],
    performance: "Excellent with WebGPU. Chrome/Edge only.",
    complexity: "high",
  },
  {
    name: "Ferrofluid",
    description:
      "Dark glossy surface erupting into magnetic spikes — alien, biomechanical. T-1000 meets sea urchin.",
    technique: "Particle-fluid sim with density-preserving dynamics, procedural geometry, environment mapping",
    tier: "exotic",
    embed: "shadertoy",
    embedId: "fl2BzW",
    thumbnail: st("fl2BzW"),
    links: [
      { label: "Shadertoy", url: "https://www.shadertoy.com/view/fl2BzW" },
      { label: "Writeup", url: "https://robert-leitl.medium.com/ferrofluid-7fd5cb55bc8d" },
    ],
    tags: ["shader", "simulation", "metallic", "alien"],
    performance: "Heavier. 3D mesh + environment mapping. Needs careful LOD.",
    complexity: "high",
  },
  {
    name: "L-System Growth",
    description:
      "Branching tree/coral structures growing from a single point. Animate growth by progressively revealing strokes. Biological, meditative.",
    technique: "Lindenmayer string-rewriting grammar, turtle graphics interpretation, stochastic branching",
    tier: "exotic",
    embed: "iframe",
    embedId: "https://www.kevs3d.co.uk/dev/lsystems/",
    thumbnail: "https://www.kevs3d.co.uk/dev/lsystems/images/fractalplant.png",
    links: [
      { label: "Interactive renderer", url: "https://www.kevs3d.co.uk/dev/lsystems/" },
      { label: "JS library", url: "https://github.com/nylki/lindenmayer" },
    ],
    tags: ["generative", "biological", "growth", "fractal"],
    performance: "Cheap to animate growth progressively.",
    complexity: "medium",
  },
  {
    name: "Fidenza Flow Fields",
    description:
      "Thick curved ribbons flowing in harmonious paths. Probabilistic color palettes. Controlled yet organic, like river currents from above.",
    technique: "2D Perlin noise vector field. Particles trace paths, collision detection prevents overlapping.",
    tier: "exotic",
    embed: "link-only",
    embedId: "",
    thumbnail: "https://www.tylerxhobbs.com/images/fidenza/fidenza-hero.jpg",
    links: [
      { label: "Tyler Hobbs writeup", url: "https://www.tylerxhobbs.com/words/fidenza" },
      { label: "Code review", url: "https://lostpixels.io/writings/code-review-fidenza" },
    ],
    tags: ["generative-art", "flow-field", "art-blocks", "ribbons"],
    performance: "Very cheap. Noise lookups + path tracing. Could animate with fading trails.",
    complexity: "medium",
  },
  {
    name: "WebGL Fire (fBM)",
    description:
      "Turbulent, fractal flames — hot whites at core fading through oranges to deep reds. Convincing organic fire.",
    technique: "Layered fBM noise with domain distortion, scrolled upward, temperature-mapped color palette",
    tier: "exotic",
    embed: "link-only",
    embedId: "",
    thumbnail: st("MdX3zr"), // use Flame shader thumbnail as representative
    links: [
      { label: "Tutorial + GLSL source", url: "https://blog.fixermark.com/posts/2025/webgl-fire-shader-based-on-fbm/" },
    ],
    tags: ["shader", "fire", "fbm", "single-pass"],
    performance: "Excellent. Same profile as domain warping.",
    complexity: "low",
  },
  {
    name: "GPGPU Galaxy",
    description:
      "Two million particles forming a slowly rotating galaxy spiral with luminous arms, dust lanes, and glowing core.",
    technique: "GPGPU ping-pong FBO. Orbital mechanics + noise perturbation. Bloom post-processing.",
    tier: "exotic",
    embed: "link-only",
    embedId: "",
    thumbnail: st("XlfGRj"), // use Star Nest as representative space visual
    links: [
      { label: "Three.js discourse", url: "https://discourse.threejs.org/t/gpgpu-galaxy-particles/88937" },
    ],
    tags: ["particles", "gpgpu", "space", "massive-scale"],
    performance: "2M particles entirely GPU-computed at 60fps.",
    complexity: "high",
  },
];

/* ------------------------------------------------------------------ */
/*  Tier labels & colors                                               */
/* ------------------------------------------------------------------ */

const TIER_META: Record<
  InspirationItem["tier"],
  { label: string; color: string; border: string; bg: string }
> = {
  "jaw-dropper": {
    label: "Jaw-Dropper",
    color: "text-[#FF6B7A]",
    border: "border-[#FF6B7A]/30",
    bg: "bg-[#FF6B7A]/8",
  },
  premium: {
    label: "Premium & Proven",
    color: "text-[#FFD93D]",
    border: "border-[#FFD93D]/30",
    bg: "bg-[#FFD93D]/8",
  },
  lightweight: {
    label: "Lightweight / CSS",
    color: "text-[#00D9A0]",
    border: "border-[#00D9A0]/30",
    bg: "bg-[#00D9A0]/8",
  },
  exotic: {
    label: "Exotic / Experimental",
    color: "text-[#A78BFA]",
    border: "border-[#A78BFA]/30",
    bg: "bg-[#A78BFA]/8",
  },
};

const COMPLEXITY_LABEL: Record<string, string> = {
  low: "Easy port",
  medium: "Moderate",
  high: "Complex",
};

/* ------------------------------------------------------------------ */
/*  Thumbnail with fallback                                            */
/* ------------------------------------------------------------------ */

function ThumbnailImage({ item }: { item: InspirationItem }) {
  return (
    <div className="relative w-full h-full bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.thumbnail}
        alt={item.name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          // On error, hide the image and show the fallback gradient
          const img = e.currentTarget;
          img.style.display = "none";
          const fallback = img.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "flex";
        }}
      />
      {/* Fallback gradient (hidden by default) */}
      <div
        className="absolute inset-0 items-center justify-center bg-gradient-to-br from-[#18181F] to-[#09090B]"
        style={{ display: "none" }}
      >
        <span className="font-mono text-xs text-white/20 uppercase tracking-[0.2em]">
          {item.name}
        </span>
      </div>
      {/* Subtle overlay for consistency */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Embed for expanded view                                            */
/* ------------------------------------------------------------------ */

function ExpandedEmbed({ item }: { item: InspirationItem }) {
  if (item.embed === "shadertoy") {
    return (
      <iframe
        src={`https://www.shadertoy.com/embed/${item.embedId}?gui=false&paused=false&muted=true`}
        className="w-full h-full border-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  if (item.embed === "codepen") {
    const [user, pen] = item.embedId.split("/");
    return (
      <iframe
        src={`https://codepen.io/${user}/embed/${pen}?default-tab=result&theme-id=dark&editable=false`}
        className="w-full h-full border-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  if (item.embed === "iframe") {
    return (
      <iframe
        src={item.embedId}
        className="w-full h-full border-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  // link-only: show thumbnail large + links
  return (
    <div className="w-full h-full relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.thumbnail}
        alt={item.name}
        className="w-full h-full object-contain bg-black"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <a
          href={item.links[0]?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm
            font-mono text-sm text-white border border-white/20 transition-colors"
        >
          Open live demo &rarr;
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

function InspirationCard({
  item,
  onExpand,
}: {
  item: InspirationItem;
  onExpand: () => void;
}) {
  const tier = TIER_META[item.tier];
  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-all duration-300
        bg-[#0F0F14] hover:translate-y-[-2px] hover:shadow-lg cursor-pointer
        ${tier.border}`}
      onClick={onExpand}
    >
      <div className="aspect-video relative overflow-hidden bg-black">
        <ThumbnailImage item={item} />
        {/* Hover overlay */}
        <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity
          bg-black/30 flex items-center justify-center">
          <span className="px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm font-mono text-xs text-white/80">
            {item.embed !== "link-only" ? "Click for live preview" : "Click for details"}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-mono text-2xs uppercase tracking-[0.15em] ${tier.color}`}>
            {tier.label}
          </span>
          <span className="text-[#252530]">&middot;</span>
          <span className="font-mono text-2xs text-[#8B8B94] uppercase tracking-wider">
            {COMPLEXITY_LABEL[item.complexity]}
          </span>
        </div>

        <h3 className="font-mono text-sm font-bold text-[#F5F5F3] tracking-wide">
          {item.name}
        </h3>
        <p className="text-xs text-[#A1A1AA] mt-1 line-clamp-2">
          {item.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="text-2xs font-mono text-[#8B8B94] px-1.5 py-0.5
                border border-[#252530]/50 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanded overlay                                                   */
/* ------------------------------------------------------------------ */

function ExpandedOverlay({
  item,
  onClose,
}: {
  item: InspirationItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
          flex items-center justify-center text-white font-mono text-sm transition-colors
          backdrop-blur-sm"
      >
        &times;
      </button>

      {/* Preview area */}
      <div className="flex-1 min-h-0">
        <ExpandedEmbed item={item} />
      </div>

      {/* Info panel */}
      <div className="bg-[#0F0F14] border-t border-[#252530] p-6 max-h-[40vh] overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-mono text-xl font-bold text-[#F5F5F3]">{item.name}</h2>
              <p className="text-sm text-[#A1A1AA] mt-1">{item.description}</p>
            </div>
            <span className={`font-mono text-2xs uppercase tracking-[0.15em] shrink-0 px-2 py-1 rounded ${TIER_META[item.tier].bg} ${TIER_META[item.tier].color}`}>
              {TIER_META[item.tier].label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-mono text-xs text-[#8B8B94] uppercase tracking-wider mb-1">Technique</p>
              <p className="text-[#A1A1AA]">{item.technique}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-[#8B8B94] uppercase tracking-wider mb-1">Performance</p>
              <p className="text-[#A1A1AA]">{item.performance}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  bg-white/5 hover:bg-white/10 border border-white/10
                  font-mono text-xs text-white/70 hover:text-white transition-colors"
              >
                {link.label}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-40">
                  <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Gallery                                                       */
/* ------------------------------------------------------------------ */

type TierFilter = "all" | InspirationItem["tier"];

export default function InspirationGallery() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<TierFilter>("all");

  const filtered = filter === "all" ? ITEMS : ITEMS.filter((i) => i.tier === filter);

  const tiers: { key: TierFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: ITEMS.length },
    { key: "jaw-dropper", label: "Jaw-Droppers", count: ITEMS.filter((i) => i.tier === "jaw-dropper").length },
    { key: "premium", label: "Premium", count: ITEMS.filter((i) => i.tier === "premium").length },
    { key: "lightweight", label: "Lightweight", count: ITEMS.filter((i) => i.tier === "lightweight").length },
    { key: "exotic", label: "Exotic", count: ITEMS.filter((i) => i.tier === "exotic").length },
  ];

  return (
    <main className="min-h-screen bg-[#09090B] text-[#F5F5F3] px-4 py-12 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <a
              href="effects"
              className="font-mono text-xs text-[#8B8B94] hover:text-[#A1A1AA] tracking-[0.3em] uppercase transition-colors"
            >
              Lab
            </a>
            <span className="text-[#252530]">/</span>
            <span className="font-mono text-xs text-[#A1A1AA] tracking-[0.3em] uppercase">
              Inspiration
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Effects Inspiration
          </h1>
          <p className="text-[#A1A1AA] mt-2 max-w-2xl text-sm">
            Curated visual effects from across the web. Click any card to see a live preview
            (Shadertoy, CodePen, or interactive demo). External links open in new tabs.
          </p>
        </header>

        {/* Tier filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tiers.map((t) => {
            const isActive = filter === t.key;
            const tierColor = t.key === "all" ? null : TIER_META[t.key as InspirationItem["tier"]];
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-mono text-xs font-medium
                  border transition-all duration-200 ${
                    isActive
                      ? tierColor
                        ? `${tierColor.bg} ${tierColor.border} ${tierColor.color}`
                        : "bg-white/10 border-white/20 text-white"
                      : "bg-white/5 border-white/10 text-[#8B8B94] hover:text-[#A1A1AA] hover:border-white/15"
                  }`}
              >
                {t.label}
                <span className={`text-2xs ${isActive ? "opacity-70" : "opacity-40"}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <InspirationCard
              key={item.name}
              item={item}
              onExpand={() => setExpanded(ITEMS.indexOf(item))}
            />
          ))}
        </div>

        {/* Integration shortcuts footer */}
        <div className="mt-16 p-6 rounded-xl border border-[#252530] bg-[#0F0F14]">
          <h2 className="font-mono text-sm font-bold text-[#F5F5F3] tracking-wide mb-3">
            Quick Integration
          </h2>
          <p className="text-xs text-[#A1A1AA] mb-4">
            Libraries that make it easy to get any of these into the lab:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://github.com/mvilledieu/shadertoy-react"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
            >
              <p className="font-mono text-xs font-bold text-[#F5F5F3]">shadertoy-react</p>
              <p className="text-2xs text-[#8B8B94] mt-1">
                6kb React component. Copy-paste any Shadertoy shader directly.
              </p>
            </a>
            <a
              href="https://github.com/xemantic/shader-web-background"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
            >
              <p className="font-mono text-xs font-bold text-[#F5F5F3]">shader-web-background</p>
              <p className="text-2xs text-[#8B8B94] mt-1">
                Vanilla JS. Renders any GLSL as a full-page background. Multi-pass support.
              </p>
            </a>
          </div>
        </div>
      </div>

      {expanded !== null && (
        <ExpandedOverlay
          item={ITEMS[expanded]}
          onClose={() => setExpanded(null)}
        />
      )}
    </main>
  );
}
