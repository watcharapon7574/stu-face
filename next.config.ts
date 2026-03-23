import type { NextConfig } from 'next'
import webpack from 'webpack'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
const humanEsmPath = path.join(__dirname, 'node_modules/@vladmandic/human/dist/human.esm.js')
const humanStubPath = path.join(__dirname, 'lib/human-stub.js')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@vladmandic/human': humanStubPath,
      }
    } else {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@vladmandic/human': humanEsmPath,
      }

      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@tensorflow/tfjs-node': false,
        'canvas': false,
        'fs': false,
        'path': false,
      }
    }

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /@tensorflow\/tfjs-node/,
      })
    )

    return config
  },
}

export default nextConfig
