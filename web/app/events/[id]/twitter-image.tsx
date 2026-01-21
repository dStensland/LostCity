// Re-export OpenGraph image for Twitter
export { default, runtime, alt, contentType } from "./opengraph-image";

// Twitter uses different dimensions
export const size = {
  width: 1200,
  height: 600,
};
