import type { LocationData } from "./types";

const TYPE_LABEL: Record<LocationData["location_type"], string> = {
  scene: "场景发生地",
  transit: "行程途经地",
};

/**
 * 详情面板：点击 marker 后展示地点数据的面板。
 * 桌面在右侧、移动端为底部抽屉（样式由 CSS media query 控制）。
 */
export class DetailPanel {
  private readonly el: HTMLElement;
  private readonly onHidden: () => void;

  constructor(onHidden: () => void) {
    this.el = document.getElementById("detail-panel")!;
    this.onHidden = onHidden;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "panel-close";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "关闭详情面板");
    closeBtn.addEventListener("click", () => this.hide());
    this.el.appendChild(closeBtn);
  }

  show(location: LocationData): void {
    // 清除上次的内容（保留关闭按钮）
    this.el
      .querySelectorAll(".panel-title, .panel-type, .passage")
      .forEach((node) => node.remove());

    const title = document.createElement("h2");
    title.className = "panel-title";
    title.innerHTML = `${escapeHtml(location.name_cn)}<span class="jp">${escapeHtml(location.name_jp)}</span>`;

    const type = document.createElement("p");
    type.className = "panel-type";
    type.textContent = `${TYPE_LABEL[location.location_type]} · 出现于第 ${location.chapters.join("、")} 章`;

    this.el.append(title, type);

    for (const pair of location.passage_pairs) {
      const passage = document.createElement("article");
      passage.className = "passage";
      passage.innerHTML = `
        <p class="passage-summary">${escapeHtml(pair.summary)}</p>
        <p class="passage-cn">${escapeHtml(pair.cn_text)}</p>
        <p class="passage-jp" lang="ja">${escapeHtml(pair.jp_text)}</p>
        <span class="passage-chapter">第 ${pair.chapter_no} 章对照引文</span>
      `;
      this.el.appendChild(passage);
    }

    this.el.classList.remove("hidden");
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.onHidden();
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
