import type { ChapterMeta } from "./data/timeline";
import { SEASON_COLOR } from "./data/timeline";

/**
 * 故事时间线：横向时间轴形式呈现 16 章（轴线 + 季节色节点 + 上下交替标签）。
 * 点击节点筛选地图与清单中的地点；再次点击或点「全部」取消筛选。
 */
export function renderTimeline(
  container: HTMLElement,
  chapters: ChapterMeta[],
  onChange: (chapterNo: number | null) => void,
): void {
  let active: number | null = null;

  const track = document.createElement("div");
  track.className = "tl-track";
  container.appendChild(track);

  // data-chapter=0 表示「全部」复位节点
  const nodes = new Map<number, HTMLButtonElement>();

  const setActive = (no: number | null): void => {
    active = no;
    for (const [n, node] of nodes) {
      node.classList.toggle("active", active === null ? n === 0 : n === active);
    }
  };

  const makeNode = (
    no: number,
    title: string,
    labelText: string,
    dotColor: string,
    flip: boolean,
  ): void => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `tl-node${flip ? " flip" : ""}`;
    node.dataset.chapter = String(no);
    node.title = title;
    node.style.setProperty("--dot-color", dotColor);

    const dot = document.createElement("span");
    dot.className = "tl-dot";
    node.appendChild(dot);

    const label = document.createElement("span");
    label.className = "tl-label";
    if (no === 0) {
      label.textContent = labelText;
    } else {
      const noEl = document.createElement("span");
      noEl.className = "tl-no";
      noEl.textContent = String(no);
      label.append(noEl, labelText);
    }
    node.appendChild(label);

    node.addEventListener("click", () => {
      if (no === 0 || active === no) {
        setActive(null);
        onChange(null);
      } else {
        setActive(no);
        onChange(no);
      }
    });

    nodes.set(no, node);
    track.appendChild(node);
  };

  // 「全部」复位节点：灰点置于轴最左
  makeNode(0, "显示全部章节", "全部", "var(--muted)", false);

  chapters.forEach((ch, i) => {
    makeNode(
      ch.no,
      `第${ch.no}章 ${ch.title_jp} · ${ch.time_label}`,
      ch.title_cn,
      SEASON_COLOR[ch.season],
      i % 2 === 0, // 标签上下交替，避免拥挤
    );
  });

  // 初始为「全部」
  setActive(null);
}
