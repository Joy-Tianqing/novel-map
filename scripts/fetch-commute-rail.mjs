/**
 * 从 OpenStreetMap Overpass API 拉取 JR 横须贺线（relation 9477155，
 * 東京 → 久里浜）的真实轨道几何，并按通勤站点在轨道上投影截取，
 * 生成 public/data/commute_route.json 供地图线图层使用。
 *
 * 用法：node scripts/fetch-commute-rail.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = resolve(ROOT, "public/data/commute_route.json");
const RELATION_ID = 9477155; // JR横須賀線 (東京 → 久里浜)，route=train

/** 横须贺线通勤途经站点（东京 → 镰仓，需与 src/map.ts COMMUTE_STATIONS 一致） */
const STATIONS = [
  ["东京站", 139.76525, 35.68301],
  ["品川", 139.74037, 35.62989],
  ["横滨站", 139.62264, 35.46601],
  ["保土谷", 139.59972, 35.44668],
  ["户冢", 139.53427, 35.40058],
  ["大船", 139.53141, 35.35431],
  ["北镰仓", 139.54516, 35.33718],
  ["镰仓站", 139.55116, 35.31936],
];

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const query = `[out:json][timeout:90];relation(${RELATION_ID});out geom;`;

/** equirectangular 近似距离平方（度，够用于投影与拼接判断） */
function dist2(a, b) {
  const mx = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dx = (a.lon - b.lon) * mx;
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;

async function main() {
  // 用法：node scripts/fetch-commute-rail.mjs [本地Overpass响应.json]
  const localFile = process.argv[2];
  let data;
  if (localFile) {
    console.log(`读取本地响应文件 ${localFile}`);
    data = JSON.parse(readFileSync(localFile, "utf8"));
  } else {
    let lastErr;
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        console.log(`请求 ${url} ...`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "novel-map/1.0 (Yomoyama literary map; contact: repo owner)",
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) throw new Error(`Overpass 请求失败: ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`端点失败，尝试下一个: ${e.message}`);
      }
    }
    if (!data) throw lastErr ?? new Error("所有 Overpass 端点均失败");
  }

  const rel = data.elements.find((e) => e.type === "relation");
  if (!rel) throw new Error("未找到 relation");

  // out geom 的 member 不带 tags，用 role 过滤：空 role 为轨道，platform 为站台
  const railWays = rel.members.filter(
    (m) => m.type === "way" && m.geometry && (m.role ?? "") === "",
  );
  console.log(`relation 中轨道 way 数量: ${railWays.length}`);

  // 按 relation 顺序把轨道段拼接成一条连续 polyline（东京 → 久里浜）
  const chain = [];
  for (const way of railWays) {
    let pts = way.geometry.map((g) => ({ lat: g.lat, lon: g.lon }));
    if (chain.length > 0) {
      const tail = chain[chain.length - 1];
      const headOk = dist2(pts[0], tail) < dist2(pts[pts.length - 1], tail);
      if (!headOk) pts = pts.slice().reverse();
    }
    for (const p of pts) {
      if (chain.length === 0 || key(p) !== key(chain[chain.length - 1])) {
        chain.push(p);
      }
    }
  }
  console.log(`拼接后轨道点数: ${chain.length}`);
  if (chain.length < 100) throw new Error("轨道点太少，拼接可能有问题");

  // 在轨道上为每个站点找最近点（索引 + 段内插值比例）
  function project(station) {
    const s = { lat: station[2], lon: station[1] };
    let best = { d: Infinity, index: -1, t: 0 };
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i];
      const b = chain[i + 1];
      const ab2 = dist2(a, b);
      let t =
        ab2 === 0
          ? 0
          : ((s.lat - a.lat) * (b.lat - a.lat) + (s.lon - a.lon) * (b.lon - a.lon)) / ab2;
      t = Math.max(0, Math.min(1, t));
      const p = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
      const d = dist2(p, s);
      if (d < best.d) best = { d, index: i, t };
    }
    return best;
  }

  const anchors = STATIONS.map((st, i) => {
    const pr = project(st);
    const meters = Math.sqrt(pr.d) * 111320;
    if (meters > 600) {
      console.warn(`⚠️ ${st[0]} 距轨道最近点约 ${Math.round(meters)}m，请核对站名/坐标`);
    } else {
      console.log(`✓ ${st[0]} 投影到轨道 @${pr.index}（偏差约 ${Math.round(meters)}m）`);
    }
    return { name: st[0], index: pr.index, t: pr.t };
  });

  // 校验投影点沿链单调递增（东京 → 镰仓方向）
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].index <= anchors[i - 1].index) {
      throw new Error(
        `锚点顺序异常: ${anchors[i - 1].name}(@${anchors[i - 1].index}) → ${anchors[i].name}(@${anchors[i].index})`,
      );
    }
  }

  // 相邻站点之间截取轨道片段
  const segments = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const line = [];
    line.push([
      chain[a.index].lon + (chain[a.index + 1].lon - chain[a.index].lon) * a.t,
      chain[a.index].lat + (chain[a.index + 1].lat - chain[a.index].lat) * a.t,
    ]);
    for (let k = a.index + 1; k <= b.index; k++) line.push([chain[k].lon, chain[k].lat]);
    line.push([
      chain[b.index].lon + (chain[b.index + 1].lon - chain[b.index].lon) * b.t,
      chain[b.index].lat + (chain[b.index + 1].lat - chain[b.index].lat) * b.t,
    ]);
    segments.push({ from: a.name, to: b.name, points: line });
    console.log(`段 ${a.name}→${b.name}: ${line.length} 点`);
  }

  const geojson = {
    type: "Feature",
    properties: {
      name: "横须贺线（东京 → 镰仓）真实轨道",
      source: `OpenStreetMap relation ${RELATION_ID} · © OpenStreetMap contributors (ODbL)`,
      stations: anchors.map((a) => a.name),
    },
    geometry: {
      type: "MultiLineString",
      coordinates: segments.map((s) => s.points),
    },
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(geojson, null, 1) + "\n");
  console.log(`已写入 ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
