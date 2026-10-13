/**
 * WorkBuddy 云服务客户端（单例，全应用共用一个实例）
 *
 * 目前只用到 LLM 模块：免密钥调用大模型——用户不需要自己准备任何 API Key。
 * 身份/数据库/存储模块尚未接入，将来要用时直接复用这个 client 即可。
 */
import { createWorkBuddyCloud } from "@tencent-ai/workbuddy-cloud-sdk";
import { publicConfig } from "./cloud-config";

export const cloud = createWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
});

/** endpoint 的 host，用于在界面上告知用户「云端模型在哪个域名下才可用」 */
export const cloudHost = (() => {
  try {
    return new URL(publicConfig.endpoint).host;
  } catch {
    return publicConfig.endpoint;
  }
})();

/** 当前页面是否运行在本应用的发布域名下（云服务按 Origin 精确匹配，只有同域才认） */
export function isOnAppDomain(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(window.location.href).host === cloudHost;
  } catch {
    return false;
  }
}
