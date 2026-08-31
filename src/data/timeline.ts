/** 章节时间线元数据：按书中故事时间推进排列（即章节顺序） */

export type Season = "summer" | "autumn" | "winter" | "spring";

export interface ChapterMeta {
  /** 章节号（1-16） */
  no: number;
  title_cn: string;
  title_jp: string;
  season: Season;
  /** 故事内的大致时间 */
  time_label: string;
}

export const SEASON_LABEL: Record<Season, string> = {
  summer: "夏",
  autumn: "秋",
  winter: "冬",
  spring: "春",
};

export const SEASON_COLOR: Record<Season, string> = {
  summer: "#4a7a3c",
  autumn: "#b0722d",
  winter: "#4a6a8c",
  spring: "#b05a7a",
};

/** 《山音》16 章的季节与时间线（两版同为 16 章，按章号对应） */
export const CHAPTERS: ChapterMeta[] = [
  { no: 1, title_cn: "山音", title_jp: "山の音", season: "summer", time_label: "盛夏 · 7月" },
  { no: 2, title_cn: "蝉翼", title_jp: "蟬の羽", season: "summer", time_label: "盛夏 · 8月" },
  { no: 3, title_cn: "云焰", title_jp: "雲の炎", season: "summer", time_label: "九月之初 · 二百十日台风" },
  { no: 4, title_cn: "栗子", title_jp: "栗の実", season: "autumn", time_label: "秋 · 10月" },
  { no: 5, title_cn: "海岛的梦", title_jp: "島の夢", season: "autumn", time_label: "晚秋 · 11月" },
  { no: 6, title_cn: "冬樱", title_jp: "冬の桜", season: "winter", time_label: "岁末—正月 · 12月—1月" },
  { no: 7, title_cn: "早露", title_jp: "朝の水", season: "winter", time_label: "正月 · 1月" },
  { no: 8, title_cn: "夜声", title_jp: "夜の声", season: "winter", time_label: "初春 · 2月" },
  { no: 9, title_cn: "春天的钟", title_jp: "春の鐘", season: "spring", time_label: "春 · 4月" },
  { no: 10, title_cn: "鸟巢", title_jp: "鳥の家", season: "spring", time_label: "春 · 5月" },
  { no: 11, title_cn: "都苑", title_jp: "都の苑", season: "spring", time_label: "春末 · 5月" },
  { no: 12, title_cn: "伤后", title_jp: "傷の後", season: "spring", time_label: "初夏 · 6月" },
  { no: 13, title_cn: "雨中", title_jp: "雨の中", season: "summer", time_label: "梅雨 · 6月" },
  { no: 14, title_cn: "蚊群", title_jp: "蚊の群", season: "summer", time_label: "盛夏 · 7—8月" },
  { no: 15, title_cn: "蛇卵", title_jp: "蛇の卵", season: "autumn", time_label: "初秋 · 9月" },
  { no: 16, title_cn: "秋鱼", title_jp: "秋の魚", season: "autumn", time_label: "秋 · 10月" },
];
