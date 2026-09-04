export const STATIC_BASE_PATH_SENTINEL = "/__AFFIRM_BASE_PATH__";
export const STATIC_BASE_PATH_LOCALHOST = "/weng/app/sp/affirmations/out";
export const STATIC_BASE_PATH_DEFAULT = "/app/sp/affirmations/out";

export function staticBasePathFromHref(href: string): string {
  return href.includes("localhost") ? STATIC_BASE_PATH_LOCALHOST : STATIC_BASE_PATH_DEFAULT;
}
