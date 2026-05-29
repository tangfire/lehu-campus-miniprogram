# 深汕校园e站小程序

论坛先行的微信小程序前端，后端默认指向本地 Docker API：

- HTTP API: `http://localhost:18080/v1`
- 登录开发 code: `mock-campus`

## 本地打开

1. 用微信开发者工具导入本目录。
2. AppID 先使用测试号或真实小程序 AppID。
3. 打开“不校验合法域名”，本地接口才能访问 `localhost`。
4. 后端启动后，进入“我的”页点登录，再进入“社区”发帖、评论、点赞。

## 体验版/正式版配置

上线前必须把 `miniprogram/utils/config.js` 里的占位域名替换成真实 HTTPS 域名：

```js
trial: 'https://你的体验版API域名/v1',
release: 'https://你的正式API域名/v1'
```

同时在微信公众平台配置 request/upload/download 合法域名，并在开发者工具里开启合法域名校验。`project.config.json` 里的 `urlCheck: false` 只用于本地开发。

## 当前阶段

- 当前主入口：`首页 / 发布 / 课表 / 我的`。
- 首页社区、发布、评论回复、消息中心、同学主页、反馈举报已经作为内测主链路。
- 课表为内测演示导入，真实教务导入需要等学校确认后再接入。
