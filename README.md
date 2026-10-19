# RhineLab 登录前端

独立可运行的登录开屏：旋转粒子地球、双螺旋、账户密码、电源登录、身份确认、权限读取和 WELCOME 动画，含对应音频。

## 运行

需要 Node.js 22.12+（或兼容 Vite 8 的更新版本）。

```bash
npm ci
npm run dev
```

浏览器打开终端显示的本地地址。点击初始粒子球启动有声流程，电源出现后等待登录。演示账户为 `admin`，密码为 `123456`，密码显示为圆点。身份确认后自动继续到 WELCOME。

```bash
npm run build
npm run preview
```

## 交互与测试

- R：重播；Space：暂停/继续；M：切换背景运动；S：静音。
- 账户输入获得焦点时不触发全局快捷键。
- 支持窗口缩放、低运动偏好、后台暂停和 Canvas 回退。
- 几何运动跟随浏览器刷新；打字与闪断按源片事件时点触发。实际帧率取决于设备和场景负载。

```bash
npx playwright install chromium
npm test
```

源码只包含此登录开屏。没有工作台、后端接口、业务数据、3D档案资源或本地研究原片；登录校验是前端交互演示，不作为真实身份认证服务。

## 结构与参考

`src/interaction/sceneController.ts` 管理时钟、登录与声音；`src/renderers` 绘制粒子和SVG动效；`src/audio` 播放音轨；`public/assets/native` 包含字体和点坐标，`public/assets/audio` 包含开屏音频。

视觉与动态参考为《毕设开场，但是明日方舟》（BV1YF411F71B），保留原稿 TANGENT OS / TANGENTJZ 视觉署名。动画参数与审查说明见 [docs/ANIMATION.md](docs/ANIMATION.md)。

## 交付验证

2026-10-20：独立项目生产构建及全部49项浏览器测试通过；提交树核查无工作台、后端、API代理、Three.js、原片或本机私有配置。测试结果针对本次提交，实际刷新率仍取决于设备与场景负载。
