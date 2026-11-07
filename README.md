# 传奇世界 · Legend World

独立的 Web 游戏项目，参考爱可小镇的技术栈创建，不依赖爱可小镇的源码或运行环境。

## 技术栈

React 19、TypeScript 7、Vite 8、PixiJS 8、Zustand 5、原生 CSS，使用 pnpm 10.26.2 管理依赖。依赖版本与创建时的参考项目保持一致，锁文件一并复用。Zustand 已声明依赖，尚未创建业务状态仓库。

## 开发

Node.js 要求：`^22.12.0 || >=24.0.0`。

```sh
cd /Users/pengchaoqun/code/legend-world
pnpm install
pnpm dev
```

同一时间运行多个 Vite 项目时，以终端实际输出的端口访问。

## 当前范围

已创建独立工程配置、React 入口、PixiJS 生命周期、响应式画布和月夜群山石门初始场景。场景使用本地矢量绘图，无外部图片依赖。支持卸载清理、异步初始化取消和设备像素比更新。

这是游戏基础工程，具体玩法尚未确定；角色、移动、战斗、任务、背包、存档及联网均未实现。不复用爱可小镇的宠物或生命模型。

## 目录

```text
src/
├── app/                 # React 界面组合
├── components/          # 游戏画布宿主
├── game/
│   ├── Game.ts          # 初始化、缩放与销毁
│   └── scenes/          # 初始世界场景和美术配置
├── stores/              # 后续 Zustand 业务状态
├── styles/              # DOM 样式
└── main.tsx             # 应用入口
```

## 验证

创建时未安装依赖，未执行构建、测试、类型检查或浏览器验证。需要验证时由用户明确要求后执行：

```sh
pnpm typecheck
pnpm lint
pnpm build
```

不自动提交代码。
