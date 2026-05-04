/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "@xenova/transformers", "onnxruntime-node"],
};

export default nextConfig;
