import {
  LngLatBounds,
  Map as MaplibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import type { LocationData } from "./types";

/** 各地点在地图上的 marker / popup 引用，按地点 id 索引 */
export interface MapHandles {
  map: MaplibreMap;
  /** 视野适配全部地点（fitBounds） */
  fitAll: () => void;
  /** 视野适配信吾家附近（镰仓一带） */
  fitHome: () => void;
  /** 视野适配上下班通勤路线（横须贺线东京—镰仓），并显示路线图层 */
  fitCommute: () => void;
  /** 选中指定地点并打开其 popup（视野不动，平移/缩放由用户控制） */
  flyTo: (location: LocationData) => void;
  /** 关闭全部 popup（同步关闭选中态时用） */
  clearPopups: () => void;
  /** 按章节筛选：仅显示章节相关的 marker / 线，其余隐藏；null 表示未选章节（全部）；
   *  切换时视野会适配到当前可见地点的范围 */
  setActiveChapters: (chapters: number[] | null) => void;
}

const TYPE_LABEL: Record<LocationData["location_type"], string> = {
  scene: "场景发生地",
  transit: "行程途经地",
};

/** OpenStreetMap 栅格底图，无需任何 token */
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** 信吾家附近（镰仓）的地点 */
const HOME_LOCATIONS = new Set(["镰仓", "镰仓站", "北镰仓", "长谷", "高德院大佛", "大船"]);

/** 以「线」呈现的地点：不再有 marker，点击 = 展示整条线 */
const LINE_LOCATIONS = new Set(["横须贺线"]);

/** 横须贺线通勤路线途经站点（东京 → 镰仓，按线路顺序） */
const COMMUTE_STATIONS: Array<[string, number, number]> = [
  ["东京站", 139.76525, 35.68301],
  ["品川", 139.74037, 35.62989],
  ["横滨站", 139.62264, 35.46601],
  ["保土谷", 139.59972, 35.44668],
  ["户冢", 139.53427, 35.40058],
  ["大船", 139.53141, 35.35431],
  ["北镰仓", 139.54516, 35.33718],
  ["镰仓站", 139.55116, 35.31936],
];

const FIT_PADDING = { top: 60, bottom: 90, left: 60, right: 60 };

function createPopup(location: LocationData): Popup {
  const label = TYPE_LABEL[location.location_type];
  return new Popup({ offset: 24, closeButton: true, maxWidth: "280px" })
    .setLngLat([location.lng, location.lat])
    .setHTML(
      `<strong>${location.name_cn}</strong> <span style="color:#8a8a8a">${location.name_jp}</span><br>` +
        `<small style="color:#8a8a8a">${label} · 共 ${location.passage_pairs.length} 条引文</small>`,
    );
}

function createMarker(location: LocationData): Marker {
  const el = document.createElement("button");
  el.className = `map-marker map-marker--${location.location_type}`;
  el.type = "button";
  el.setAttribute("aria-label", location.name_cn);
  el.title = `${location.name_cn}（${TYPE_LABEL[location.location_type]}）`;

  return new Marker({ element: el }).setLngLat([
    location.lng,
    location.lat,
  ]);
}

/** 瓦片加载指示器：dataloading 时亮起，idle 或超时后熄灭（适配慢瓦片） */
function setupLoadingIndicator(map: MaplibreMap): void {
  const bar = document.getElementById("map-loading");
  if (!bar) return;

  let safety: ReturnType<typeof setTimeout> | undefined;

  const activate = (): void => {
    bar.classList.add("active");
    // 兜底：网络异常导致 idle 迟迟不来时，10s 后自动熄灭
    clearTimeout(safety);
    safety = setTimeout(() => bar.classList.remove("active"), 10_000);
  };
  const deactivate = (): void => {
    clearTimeout(safety);
    bar.classList.remove("active");
  };

  map.on("dataloading", activate);
  map.on("idle", deactivate);
  map.on("error", deactivate);
}

export function initMap(
  locations: LocationData[],
  onSelect: (location: LocationData) => void,
  onEmptyClick?: () => void,
): MapHandles {
  const map = new MaplibreMap({
    container: "map",
    style: OSM_STYLE,
    center: [139.3, 35.6], // 东京湾一带，覆盖主要地点
    zoom: 7,
    // 瓦片渐进加载时先给一个温和的底色，避免大片惨白
    // （底图未就绪时 marker 已可见）
  });
  map.addControl(new NavigationControl(), "top-left"); // 右上留给详情面板

  const markers = new Map<string, Marker>();
  const popups = new Map<string, Popup>();
  const lineLocation = locations.find((l) => LINE_LOCATIONS.has(l.name_cn));

  // ============ 显隐状态 ============
  // 规则：未选章节（全部/默认）时全部展示；选中章节后只显示相关的；
  // 线状地点被选中时展示整条线，选中点状地点时收起线（互斥）。
  let selectedLocation: LocationData | null = null;
  let currentChapters: number[] | null = null;

  for (const location of locations) {
    // 线状地点不建 marker / popup，交互走 commute-route 线图层
    if (LINE_LOCATIONS.has(location.name_cn)) continue;
    const marker = createMarker(location);
    marker.getElement().addEventListener("click", (e) => {
      // 不冒泡到地图容器，否则会触发 popup 的 closeOnClick 把刚打开的 popup 立刻关掉
      e.stopPropagation();
      onSelect(location);
    });
    marker.addTo(map);
    markers.set(location.id, marker);

    const popup = createPopup(location);
    popups.set(location.id, popup);
  }

  const closeAllPopups = (): void => {
    for (const popup of popups.values()) popup.remove();
    // 同步复位显隐状态：取消选中后，marker/线回归章节筛选决定的可见性
    selectedLocation = null;
    refreshMarkers();
    refreshLine();
  };

  // 点击地图空白处（底图画布）视为取消选中；popup 自带的 closeOnClick
  // 会先关掉 popup，这里同步收起详情面板
  map.on("click", (e) => {
    const target = e.originalEvent.target;
    // 只把"点在底图上"当作空白点击；marker（已 stopPropagation）与
    // popup 内部的点击不属于取消选中
    if (
      target instanceof HTMLElement &&
      !target.classList.contains("maplibregl-canvas")
    )
      return;
    // 点中路线线段 = 选中线状地点，不算空白点击
    if (
      map.getLayer("commute-route") &&
      map.queryRenderedFeatures(e.point, { layers: ["commute-route"] }).length > 0
    )
      return;
    onEmptyClick?.();
  });

  const boundsOf = (items: LocationData[]): LngLatBounds => {
    const bounds = new LngLatBounds();
    for (const l of items) bounds.extend([l.lng, l.lat]);
    return bounds;
  };

  // 线状地点的视野适配范围：优先用真实轨道几何，未加载完成时退回站点坐标
  let routeBounds: LngLatBounds | null = null;
  const stationBounds = (): LngLatBounds => {
    const bounds = new LngLatBounds();
    for (const [, lng, lat] of COMMUTE_STATIONS) bounds.extend([lng, lat]);
    return bounds;
  };
  const focusLine = (): void => {
    map.fitBounds(routeBounds ?? stationBounds(), {
      padding: FIT_PADDING,
      maxZoom: 12,
    });
  };

  // 通勤路线图层：加载完成后注册，默认隐藏
  const setupCommuteLayer = (): void => {
    map.addSource("commute", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    // 真实轨道几何（OSM relation 9477155），由 scripts/fetch-commute-rail.mjs 生成
    fetch(`${import.meta.env.BASE_URL}data/commute_route.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`commute_route.json 加载失败: ${r.status}`);
        return r.json();
      })
      .then((route) => {
        (map.getSource("commute") as GeoJSONSource).setData(route);
        routeBounds = new LngLatBounds();
        for (const line of route.geometry.coordinates as [number, number][][]) {
          for (const [lng, lat] of line) routeBounds.extend([lng, lat]);
        }
        refreshLine();
      })
      .catch((e) => console.error(e));
    map.addLayer({
      id: "commute-route",
      type: "line",
      source: "commute",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#4a7a8c",
        "line-width": 3,
        "line-opacity": 0.9,
      },
    });
    // 图层异步创建，就绪后立即应用当前显隐意图
    refreshLine();

    if (!lineLocation) return;
    // 线本身可点击选中（等价于 marker 的点击）
    map.on("click", "commute-route", () => onSelect(lineLocation));
    map.on("mouseenter", "commute-route", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "commute-route", () => {
      map.getCanvas().style.cursor = "";
    });
  };
  map.on("load", setupCommuteLayer);

  // 瓦片加载指示器
  setupLoadingIndicator(map);

  // 点状地点的视野范围（线状地点不参与，避免错误锚点拉偏视野）
  const pointLocations = locations.filter((l) => !LINE_LOCATIONS.has(l.name_cn));

  // ============ 显隐刷新 ============
  const refreshMarkers = (): void => {
    for (const location of pointLocations) {
      const el = markers.get(location.id)?.getElement();
      if (!el) continue;
      const chapters = currentChapters;
      const chapterOk =
        chapters === null || location.chapters.some((c) => chapters.includes(c));
      const visible = chapterOk || location === selectedLocation;
      el.style.display = visible ? "" : "none";
    }
  };
  const refreshLine = (): void => {
    if (!map.getLayer("commute-route")) return;
    const chapters = currentChapters;
    let visible: boolean;
    if (chapters === null) {
      // 全部态：展示线，但选中了某个点状地点时收起（互斥）
      visible = selectedLocation === null || selectedLocation === lineLocation;
    } else {
      const chapterOk =
        !!lineLocation && lineLocation.chapters.some((c) => chapters.includes(c));
      visible = chapterOk || selectedLocation === lineLocation;
    }
    map.setLayoutProperty(
      "commute-route",
      "visibility",
      visible ? "visible" : "none",
    );
  };
  // 初始（未选章节、未选中地点）：全部展示
  refreshMarkers();

  // 初始就绪后自动适配全部地点，第一眼即见全貌
  map.on("load", () => {
    map.fitBounds(boundsOf(pointLocations), { padding: FIT_PADDING, maxZoom: 12 });
  });

  // 切换章节时视野适配：聚焦当前章节相关地点的范围（点 + 可见的线）
  const fitToChapters = (chapters: number[] | null): void => {
    const bounds = new LngLatBounds();
    let hasPoint = false;
    for (const l of pointLocations) {
      if (chapters === null || l.chapters.some((c) => chapters.includes(c))) {
        bounds.extend([l.lng, l.lat]);
        hasPoint = true;
      }
    }
    // 章节包含线状地点时，把线的范围也纳入视野
    const lineInChapter =
      lineLocation !== undefined &&
      chapters !== null &&
      lineLocation.chapters.some((c) => chapters.includes(c));
    if (lineInChapter) {
      const lineBounds = routeBounds ?? stationBounds();
      bounds.extend(lineBounds.getSouthWest()).extend(lineBounds.getNorthEast());
    }
    if (hasPoint) {
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 14 });
    } else if (lineInChapter) {
      focusLine();
    }
  };

  return {
    map,
    fitAll: () => {
      map.fitBounds(boundsOf(pointLocations), { padding: FIT_PADDING, maxZoom: 12 });
    },
    fitHome: () => {
      const home = locations.filter((l) => HOME_LOCATIONS.has(l.name_cn));
      map.fitBounds(boundsOf(home), { padding: 80, maxZoom: 14 });
    },
    fitCommute: () => focusLine(),
    flyTo: (location) => {
      closeAllPopups();
      selectedLocation = location;
      refreshMarkers();
      // 线状地点：展示整条线并适配其范围，不飞向某个点
      if (LINE_LOCATIONS.has(location.name_cn)) {
        focusLine();
        return;
      }
      // 选中任何点状地点时收起路线，保持「marker 或线」互斥
      // （refreshLine 依据 selectedLocation 自动处理）
      // 视野不动：只打开 popup，平移/缩放均由用户自己控制
      popups.get(location.id)?.addTo(map);
    },
    clearPopups: closeAllPopups,
    setActiveChapters: (chapters) => {
      currentChapters = chapters;
      refreshMarkers();
      refreshLine();
      fitToChapters(chapters);
    },
  };
}
