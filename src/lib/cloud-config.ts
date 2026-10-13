/**
 * WorkBuddy 云服务 publicConfig（自动生成，来源：云服务开通结果）
 *
 * 这四个字段是**唯一**可以打进前端产物的配置：
 *   - resourceId      云服务资源 ID
 *   - endpoint        本应用的发布域名数据面基址
 *   - oauthRelayBaseUrl  中心 OAuth Relay 基址
 *   - publishableKey  只标识「哪个应用」、不携带权限（安全性由服务端 Origin 精确匹配提供）
 *
 * 注意：
 *   - 不要手改这些值。重新发布 / 追加域名后，请回到 WorkBuddy 云服务面板重新获取 publicConfig。
 *   - 应用必须运行在 endpoint 对应的域名下，云服务才认这个前端（服务端按 Origin 精确匹配）。
 *     本地 dev server 属于跨域，是否放行取决于服务端对 localhost 的策略。
 */
export const publicConfig = {
  resourceId: "wbcs_0mVSDDLjk2WW0eqGFJv4cG",
  endpoint: "https://careervault.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey: "wbpk_xzRExJm4IYRuG1HCUWmpGi_XhxaDR1D2hr39TUfBZ35135clBdcV2Q2",
} as const;
