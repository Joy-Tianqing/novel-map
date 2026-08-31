import type { LocationData } from "./types";

const GROUP_LABEL: Record<LocationData["location_type"], string> = {
  scene: "场景发生地",
  transit: "行程途经地",
};

/**
 * 地点清单：全部地点的可点击列表，作为地图旁的导航入口。
 * @param chapterFilter 章节筛选：只显示出现在这些章节中的地点；null 表示全部
 */
export function renderLocationList(
  locations: LocationData[],
  onSelect: (location: LocationData) => void,
  chapterFilter: number[] | null = null,
): void {
  const container = document.getElementById("location-list")!;
  container.innerHTML = "";

  const filtered =
    chapterFilter === null
      ? locations
      : locations.filter((l) => l.chapters.some((c) => chapterFilter.includes(c)));

  for (const group of ["scene", "transit"] as const) {
    const items = filtered.filter((l) => l.location_type === group);

    const title = document.createElement("h3");
    title.className = "list-group-title";
    title.textContent = `${GROUP_LABEL[group]}（${items.length}）`;
    container.appendChild(title);

    for (const location of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-item";
      btn.dataset.locationId = location.id;
      btn.innerHTML =
        `${escapeHtml(location.name_cn)}<span class="jp">${escapeHtml(location.name_jp)}</span>` +
        `<span class="chapters">第 ${location.chapters.join("、")} 章 · ${location.passage_pairs.length} 条引文</span>`;
      btn.addEventListener("click", () => onSelect(location));
      container.appendChild(btn);
    }
  }

  if (chapterFilter !== null && filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "list-group-title";
    empty.textContent = "该章节没有对应的地点。";
    container.appendChild(empty);
  }
}

/** 高亮清单中当前选中的地点 */
export function highlightListItem(locationId: string | null): void {
  document.querySelectorAll<HTMLButtonElement>(".list-item").forEach((btn) => {
    btn.style.background = btn.dataset.locationId === locationId ? "#f0e7e2" : "";
  });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
