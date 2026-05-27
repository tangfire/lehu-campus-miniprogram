# 深汕校园e站小程序上线检查清单

## 内部体验版

- 在 `miniprogram/utils/config.js` 配置 `trial` 的 HTTPS API 域名。
- 微信公众平台配置 request/uploadFile 合法域名。
- 微信开发者工具上传体验版，真机验证登录、浏览、发布、评论、收藏、撤回、举报、反馈。
- 后台发布 8-12 条“深汕e仔”官方置顶/精选内容，首页推荐流确认可见。
- 后台确认运营账号权限可用，普通用户不能访问 `/admin` 接口。

## 正式版

- `project.config.json` 正式提审前开启 URL 检查，不依赖本地 `urlCheck: false`。
- 在 `miniprogram/utils/config.js` 配置 `release` 的 HTTPS API 域名。
- 补齐微信小程序隐私保护指引：头像、相册、相机、视频、网络请求、用户反馈。
- 检查用户协议、隐私政策、社区规范入口都能打开。
- 确认后端生产环境未开启 `LEHU_CAMPUS_ADMIN_ALLOW_ALL=true`。
- 确认内容举报、反馈处理、安全中心、IP 封禁可用。

## 运营冷启动

- 报到总攻略
- 宿舍 FAQ
- 到校路线
- 课表导入说明
- 校园网提醒
- 快递说明
- 军训待确认说明
- 社团招新入口
- 失物招领模板
- 新生问答引导
