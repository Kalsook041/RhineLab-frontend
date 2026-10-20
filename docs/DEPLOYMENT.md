# GitHub Pages 部署

站点：https://kalsook041.github.io/RhineLab-frontend/

发布内容仅为独立登录前端的dist，不含工作台、后端、原始视频、AE工程、本机配置或研究记录。

## 构建与更新

GitHub仓库Settings → Pages的Source设为GitHub Actions。`.github/workflows/deploy-pages.yml`在main更新或手动触发时，用Node24执行npm ci和npm run build:pages。build只需要contents:read，deploy只授予pages:write与id-token:write；Actions固定到已核对的官方提交。上传范围仅dist。并发部署串行执行，不中断进行中的发布。

`npm run build`保留根路径构建；`npm run build:pages`使用`/RhineLab-frontend/`作为Vite base。字体和入口由Vite转换资源地址，地图点坐标和音频统一使用import.meta.env.BASE_URL，防止部署后误请求github.io根目录的assets。没有修改动画时钟、粒子或音频内容。

## 本地验证

```bash
npm ci
npm run test:pages
```

test:pages先生成实际Pages产物，使用4280端口提供真实生产预览，自动检查子路径资源请求、字体/地图/声音加载、初始球体→电源登录→WELCOME、移动视口、无媒体替代和无根assets误请求。

部署后还应检查Actions部署成功、首页及JS/CSS/六份字体/两份粒子JSON/音频为200且类型正确，在公网地址真实点击并到达WELCOME。rAF更新率与120Hz验证仍见PERFORMANCE.md，静态托管本身不保证访问者设备帧率。

实现依据：[Vite GitHub Pages指南](https://vite.dev/guide/static-deploy#github-pages)、[GitHub Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 审查与修复提示词

审查提示词：审查本轮Pages部署。范围为nativeBackground的BASE_URL资源路径、build:pages脚本、deploy-pages工作流和生产子路径测试。验收：本地根路径继续工作，Pages子路径下所有字体/点坐标/音频200且MIME正确，真实交互到WELCOME，原动画和音轨不变；工作流只上传纯登录dist、不含工作台/私有文件，权限按job最小授予，Actions固定官方提交；Actions部署成功且公网可访问。运行npm run test:pages及受影响根路径回归，检查公网完整流程和网络响应。只输出“优先级、文件行号、复现步骤、预期/实际、证据、最小修复建议”；无发现明确说明。

修复提示词：按上述验收只修新的可复现问题，保留登录原时序、声音和分辨率，不引入工作台或后端；重跑相关检查并核对最新部署提交与公网资源。没有新的可行动发现时保持代码不变，明确验证范围与限制。

## 发布前验证记录（2026-10-20）

生产子路径完整流程测试通过。首轮发现preview未传子路径导致脚本404，修正preview命令后通过；构建显式emptyOutDir避免残留历史产物。Pages已通过API启用，build_type=workflow。根路径背景/启动/相位回归单独检查，最终公网结果在交付时核对。没有修改动画效果。
