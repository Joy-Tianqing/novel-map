import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages 静态托管，私有仓库部署在子路径下
  base: "/novel-map/",
  optimizeDeps: {
    // MapLibre 6.x 依据自身模块的 import.meta.url 相对加载
    // maplibre-gl-worker.mjs；Vite 预打包会把入口复制进
    // node_modules/.vite/deps/ 但不带 worker 文件，导致 worker 404、
    // 所有 GeoJSON 图层（线/面）静默不渲染。排除预打包即可。
    exclude: ["maplibre-gl"],
  },
  build: {
    sourcemap: false,
  },
});
