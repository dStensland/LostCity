"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ShaderCanvasProps {
  /** GLSL fragment shader source */
  fragmentShader: string;
  /** Optional uniform values (updated each frame) */
  uniforms?: Record<string, number | number[]>;
  /** Resolution scale factor (0.5 = half res for mobile) */
  resolutionScale?: number;
  /** CSS class for the container div */
  className?: string;
  /** Fallback gradient CSS (shown while loading or on WebGL failure) */
  fallbackGradient?: string;
}

const DEFAULT_VERTEX = `#version 300 es
precision mediump float;
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function ShaderCanvas({
  fragmentShader,
  uniforms = {},
  resolutionScale = 1,
  className = "",
  fallbackGradient = "linear-gradient(135deg, var(--void), var(--night))",
}: ShaderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const programRef = useRef<WebGLProgram | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const uniformsRef = useRef(uniforms);
  const [failed, setFailed] = useState(false);

  // Keep uniforms ref current without re-running effects
  uniformsRef.current = uniforms;

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) { setFailed(true); return false; }

    const vert = createShader(gl, gl.VERTEX_SHADER, DEFAULT_VERTEX);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vert || !frag) { setFailed(true); return false; }

    const program = gl.createProgram();
    if (!program) { setFailed(true); return false; }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Program link error:", gl.getProgramInfoLog(program));
      setFailed(true);
      return false;
    }

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posAttr = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    glRef.current = gl;
    programRef.current = program;
    startTimeRef.current = performance.now();
    return true;
  }, [fragmentShader]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const gl = glRef.current;
    if (!canvas || !container || !gl) return;

    const dpr = Math.min(window.devicePixelRatio, 2) * resolutionScale;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }, [resolutionScale]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !canvas) return;

    const time = (performance.now() - startTimeRef.current) / 1000;
    const timeLoc = gl.getUniformLocation(program, "u_time");
    if (timeLoc) gl.uniform1f(timeLoc, time);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);

    // Set custom uniforms from ref (avoids re-creating render callback)
    for (const [name, value] of Object.entries(uniformsRef.current)) {
      const loc = gl.getUniformLocation(program, name);
      if (!loc) continue;
      if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else if (value.length === 4) gl.uniform4fv(loc, value);
      } else {
        gl.uniform1f(loc, value);
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    rafRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    // Reduced motion check
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFailed(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let initialized = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !initialized) {
          initialized = initGL();
          if (initialized) {
            resize();
            rafRef.current = requestAnimationFrame(render);
          }
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(container);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(rafRef.current);
      } else if (initialized) {
        rafRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleResize = () => { if (initialized) resize(); };
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      const gl = glRef.current;
      if (gl && programRef.current) {
        gl.deleteProgram(programRef.current);
      }
    };
  }, [initGL, resize, render]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={failed ? { background: fallbackGradient } : undefined}
    >
      {!failed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block" }}
        />
      )}
    </div>
  );
}
