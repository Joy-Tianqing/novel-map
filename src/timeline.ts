import type { ChapterMeta } from "./data/timeline";
import { SEASON_COLOR } from "./data/timeline";

/**
 * 故事时间线：按章节顺序（即故事时间推进）展示 16 章。
 * 点击章节筛选地图与清单中的地点；再次点击或点「全部」取消筛选。
 */
export function renderTimeline(
  container: HTMLElement,
  chapters: ChapterMeta[],
  onChange: (chapterNo: number | null) => void,
): void {
  let active: number | null = null;

  const setActive = (no: number | null): void => {
    active = no;
    container
      .querySelectorAll<HTMLButtonElement>(".timeline-chip")
      .forEach((chip) => {
        const no = Number(chip.dataset.chapter);
        chip.classList.toggle("active", active === null ? no === 0 : no === active);
      });
  };

  // 「全部」复位芯片（data-chapter=0 表示无筛选）
  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "timeline-chip active";
  allChip.dataset.chapter = "0";
  allChip.textContent = "全部";
  allChip.addEventListener("click", () => {
    setActive(null);
    onChange(null);
  });
  container.appendChild(allChip);

  for (const ch of chapters) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "timeline-chip";
    chip.dataset.chapter = String(ch.no);
    chip.title = `第${ch.no}章 ${ch.title_jp} · ${ch.time_label}`;
    chip.innerHTML =
      `<span class="chip-season" style="background:${SEASON_COLOR[ch.season]}"></span>` +
      `<span class="chip-no">${ch.no}</span>${ch.title_cn}`;
    chip.addEventListener("click", () => {
      if (active === ch.no) {
        setActive(null);
        onChange(null);
      } else {
        setActive(ch.no);
        onChange(ch.no);
      }
    });
    container.appendChild(chip);
  }
}
