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

  // ============ 移动端：地点清单折叠 ============
  // 仅移动端样式生效；选中地点时自动收起，把空间让给地图与详情抽屉
  const appEl = document.getElementById("app")!;
  const sidebarToggle = document.getElementById("sidebar-toggle")!;

  const setSidebarCollapsed = (collapsed: boolean): void => {
    appEl.classList.toggle("sidebar-collapsed", collapsed);
    sidebarToggle.textContent = collapsed ? "展开清单 ▾" : "收起清单 ▴";
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  };

  sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(!appEl.classList.contains("sidebar-collapsed"));
  });

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
    setSidebarCollapsed(true); // 移动端选中后收起清单，避免长时间遮挡地图
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

  const viewButtons = ["view-all", "view-home", "view-commute"].map((id) =>
    document.getElementById(id) as HTMLButtonElement,
  );
  // 同步 aria-pressed，向读屏器声明当前激活的预设
  const markActiveView = (id: string): void => {
    for (const btn of viewButtons) {
      btn.setAttribute("aria-pressed", String(btn.id === id));
    }
  };

  const preset = (fn: (h: MapHandles) => void, id: string): void => {
    clearSelection(); // 切换视野时重置选中态，保持画面干净
    markActiveView(id);
    if (handles) fn(handles);
  };

  document.getElementById("view-all")!.addEventListener("click", () =>
    preset((h) => h.fitAll(), "view-all"),
  );
  document.getElementById("view-home")!.addEventListener("click", () =>
    preset((h) => h.fitHome(), "view-home"),
  );
  document.getElementById("view-commute")!.addEventListener("click", () =>
    preset((h) => h.fitCommute(), "view-commute"),
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
