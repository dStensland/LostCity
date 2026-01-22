import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable verbose Fast Refresh logging in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rtppvljfrkjtoxmaizea.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "img.evbuc.com",
      },
      {
        protocol: "https",
        hostname: "cdn.evbuc.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.ticketmaster.com",
      },
      {
        protocol: "https",
        hostname: "s1.ticketm.net",
      },
      {
        protocol: "https",
        hostname: "localist-images.azureedge.net",
      },
      {
        protocol: "https",
        hostname: "indy-systems.imgix.net",
      },
      {
        protocol: "https",
        hostname: "bunny-wp-pullzone-2v7xwnunut.b-cdn.net",
      },
      {
        protocol: "https",
        hostname: "funspotamericaatlanta.com",
      },
      {
        protocol: "https",
        hostname: "**.b-cdn.net",
      },
    ],
  },
};

export default nextConfig;
