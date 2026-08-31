import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { initMap, type MapHandles } from "./map";
import { DetailPanel } from "./panel";
import { highlightListItem, renderLocationList } from "./list";
import { renderTimeline } from "./timeline";
import { CHAPTERS } from "./data/timeline";
import type { LocationData } from "./types";

async function loadLocations(): Promise<LocationData[]> {
  const resp = await fetch("data/locations.json");
  if (!resp.ok) {
    throw new Error(`加载地点数据失败: ${resp.status}`);
  }
  return resp.json();
}

async function main(): Promise<void> {
  let locations: LocationData[];
  try {
    locations = await loadLocations();
  } catch (err) {
    document.getElementById("location-list")!.textContent =
      "地点数据加载失败，请刷新重试。";
    console.error(err);
    return;
  }

  // ============ 选中态：面板 + popup + 清单高亮 统一管理 ============

  let handles: MapHandles | null = null;
  let selectedId: string | null = null;

  const clearSelection = (): void => {
    if (selectedId === null) return;
    selectedId = null;
    panel.hide(); // 触发 onHidden → 复位清单高亮 + 关闭 popup
  };

  const panel = new DetailPanel(() => {
    selectedId = null;
    highlightListItem(null);
    handles?.clearPopups();
  });

  function select(location: LocationData): void {
    // 再点同一个地点 = 切换关闭
    if (selectedId === location.id) {
      clearSelection();
      return;
    }
    selectedId = location.id;
    panel.show(location);
    highlightListItem(location.id);
    handles?.flyTo(location);
  }

  // 地图初始化失败时降级：仅清单 + 详情面板可用
  try {
    handles = initMap(locations, select, clearSelection);
  } catch (err) {
    console.error(err);
    const notice = document.createElement("p");
    notice.className = "list-group-title";
    notice.textContent = "地图加载失败，请检查网络后刷新重试。";
    document.getElementById("location-list")!.prepend(notice);
  }

  // ESC 取消选中（地图应用通用约定）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearSelection();
  });

  // ============ 视野预设 ============

  const preset = (fn: (h: MapHandles) => void): void => {
    clearSelection(); // 切换视野时重置选中态，保持画面干净
    if (handles) fn(handles);
  };

  document.getElementById("view-all")!.addEventListener("click", () =>
    preset((h) => h.fitAll()),
  );
  document.getElementById("view-home")!.addEventListener("click", () =>
    preset((h) => h.fitHome()),
  );
  document.getElementById("view-commute")!.addEventListener("click", () =>
    preset((h) => h.fitCommute()),
  );

  // ============ 地点清单 + 故事时间线（章节筛选联动） ============

  let chapterFilter: number[] | null = null;

  const applyFilter = (): void => {
    handles?.setActiveChapters(chapterFilter);
    renderLocationList(locations, select, chapterFilter);
    if (selectedId !== null) {
      // 筛选变化后，原选中地点可能已不在场景内，同步收起
      const stillVisible = locations.some(
        (l) =>
          l.id === selectedId &&
          l.chapters.some((c) => chapterFilter?.includes(c) ?? true),
      );
      if (!stillVisible) clearSelection();
    }
  };

  renderLocationList(locations, select);

  renderTimeline(document.getElementById("timeline")!, CHAPTERS, (chapterNo) => {
    chapterFilter = chapterNo === null ? null : [chapterNo];
    applyFilter();
  });
}

main();
