import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages 静态托管，私有仓库部署在子路径下
  base: "/novel-map/",
  build: {
    sourcemap: false,
  },
});
