import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * MapLibre 6.x 生产构建修复：运行时按 `new URL("./maplibre-gl-worker.mjs",
 * import.meta.url)` 相对主 bundle 解析 worker，但 Vite 构建不会把 worker
 * 及其依赖拷进产物，导致 worker 404/加载失败、所有 GeoJSON 图层（线/面）
 * 静默不渲染。构建结束后把 worker 和它 import 的 shared chunk 一并复制
 * 到 dist/assets/，即可与运行时解析路径对齐。
 */
const copyMaplibreWorker = (): Plugin => ({
  name: "copy-maplibre-worker",
  closeBundle() {
    mkdirSync("dist/assets", { recursive: true });
    for (const file of [
      "maplibre-gl-worker.mjs",
      "maplibre-gl-shared.mjs",
    ]) {
      copyFileSync(
        join("node_modules", "maplibre-gl", "dist", file),
        join("dist", "assets", file),
      );
    }
  },
});

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
  plugins: [copyMaplibreWorker()],
});
