/** 地点数据类型定义 */

export type LocationType = "scene" | "transit";

/** 对照引文：同一情节片段的中译本与日文原版配对 */
export interface PassagePair {
  /** 所属章节号 */
  chapter_no: number;
  /** 情节简述 */
  summary: string;
  /** 中译本引文 */
  cn_text: string;
  /** 日文原版引文 */
  jp_text: string;
}

/** 地点数据：经纬度、中日地名写法、该地点全部对照引文 */
export interface LocationData {
  id: string;
  name_cn: string;
  name_jp: string;
  location_type: LocationType;
  chapters: number[];
  lat: number;
  lng: number;
  passage_pairs: PassagePair[];
}
