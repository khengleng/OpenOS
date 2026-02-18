declare module 'next-pwa' {
    import type { NextConfig } from 'next';

    interface PWAPluginOptions {
        dest: string
        disable?: boolean
        register?: boolean
        skipWaiting?: boolean
        [key: string]: unknown
    }

    type WithPWA = (config: NextConfig) => NextConfig

    function nextPwa(options: PWAPluginOptions): WithPWA

    export default nextPwa
}
