import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@arena/game-core', '@arena/game-data', '@arena/game-ai', '@arena/shared-types'],
  devIndicators: false,
};
export default config;
