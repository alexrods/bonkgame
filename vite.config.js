import { defineConfig } from 'vite';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import viteImagemin from 'vite-plugin-imagemin'
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'whitelist.txt', // copy whitelist.txt to root of dist
          dest: ''
        }
      ]
    }),
    // viteImagemin({
    //   webp: { quality: 60 },
    //   avif: { quality: 50 },
    // })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
