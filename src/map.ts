import {
  LngLatBounds,
  Map as MaplibreMap,
  Marker,
  NavigationControl,
  Popup,
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
  /** 飞行到指定地点并打开其 popup */
  flyTo: (location: LocationData) => void;
  /** 关闭全部 popup（同步关闭选中态时用） */
  clearPopups: () => void;
  /** 按章节筛选：不在章节内的 marker 置灰；null 表示全部 */
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

  for (const location of locations) {
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
    onEmptyClick?.();
  });

  const boundsOf = (items: LocationData[]): LngLatBounds => {
    const bounds = new LngLatBounds();
    for (const l of items) bounds.extend([l.lng, l.lat]);
    return bounds;
  };

  // 通勤路线图层：加载完成后注册，默认隐藏
  const setupCommuteLayer = (): void => {
    map.addSource("commute", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: COMMUTE_STATIONS.map(([, lng, lat]) => [lng, lat]),
        },
      },
    });
    map.addLayer({
      id: "commute-route",
      type: "line",
      source: "commute",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#4a7a8c",
        "line-width": 2.5,
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.8,
      },
    });
  };
  map.on("load", setupCommuteLayer);

  const showCommute = (visible: boolean): void => {
    if (!map.getSource("commute")) return;
    map.setLayoutProperty(
      "commute-route",
      "visibility",
      visible ? "visible" : "none",
    );
  };

  // 瓦片加载指示器
  setupLoadingIndicator(map);

  // 初始就绪后自动适配全部地点，第一眼即见全貌
  map.on("load", () => {
    map.fitBounds(boundsOf(locations), { padding: FIT_PADDING, maxZoom: 12 });
  });

  return {
    map,
    fitAll: () => {
      showCommute(false);
      map.fitBounds(boundsOf(locations), { padding: FIT_PADDING, maxZoom: 12 });
    },
    fitHome: () => {
      showCommute(false);
      const home = locations.filter((l) => HOME_LOCATIONS.has(l.name_cn));
      map.fitBounds(boundsOf(home), { padding: 80, maxZoom: 14 });
    },
    fitCommute: () => {
      showCommute(true);
      const bounds = new LngLatBounds();
      for (const [, lng, lat] of COMMUTE_STATIONS) bounds.extend([lng, lat]);
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 12 });
    },
    flyTo: (location) => {
      closeAllPopups();
      // 避开右侧详情面板/底部时间线，让目标点落在可见区域中心
      const mobile = window.innerWidth <= 768;
      map.flyTo({
        center: [location.lng, location.lat],
        zoom: 13,
        duration: 1200,
        padding: mobile
          ? { top: 60, bottom: window.innerHeight * 0.62, left: 40, right: 40 }
          : { top: 80, bottom: 110, left: 80, right: 400 },
      });
      popups.get(location.id)?.addTo(map);
    },
    clearPopups: closeAllPopups,
    setActiveChapters: (chapters) => {
      for (const location of locations) {
        const el = markers.get(location.id)?.getElement();
        if (!el) continue;
        const dimmed =
          chapters !== null && !location.chapters.some((c) => chapters.includes(c));
        el.classList.toggle("map-marker--dim", dimmed);
      }
    },
  };
}
