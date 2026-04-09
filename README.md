<div align="center">

# 终末地公文生成器

**用于生成《明日方舟：终末地》游戏世界观中各机构签发的红头公文的工具**

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Typst](https://img.shields.io/badge/Typst-WebAssembly-239DAD?logo=typst&logoColor=white)](https://typst.app)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

## 功能特性

- 在浏览器中实时生成红头公文风格的 PDF 文件，无需后端服务
- 支持自定义签发机构、文件标题、发文字号、签发日期等参数
- 自动生成带有随机偏移和旋转的圆形公章
- 基于 Typst 排版引擎，内容区域支持 Typst 标记语法
- PDF 实时预览、在新标签页中打开、下载
- 表单内容自动持久化至浏览器本地存储
- 明暗主题切换
- 中英双语界面

## 技术栈

| 层级     | 技术                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------- |
| 框架     | [SvelteKit](https://svelte.dev) + [Svelte 5](https://svelte.dev/docs/svelte/overview) (Runes 模式) |
| 排版引擎 | [Typst](https://typst.app) (通过 WebAssembly 在浏览器中运行)                                       |
| 组件库   | [shadcn-svelte](https://www.shadcn-svelte.com) + [Bits UI](https://bits-ui.com)                    |
| 样式     | [Tailwind CSS 4](https://tailwindcss.com)                                                          |
| 国际化   | [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) (Inlang)                  |
| 图标     | [Phosphor](https://phosphoricons.com) + [Lucide](https://lucide.dev)                               |
| 构建工具 | [Vite](https://vite.dev) + Brotli 压缩                                                             |
| 部署     | 静态站点 (`@sveltejs/adapter-static`)                                                              |

## 项目结构

```
endfield-docmaker/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # 根布局
│   │   ├── +page.svelte            # 主页面（表单 + PDF 预览）
│   │   └── layout.css              # 全局样式与主题变量
│   ├── lib/
│   │   ├── components/
│   │   │   ├── DateInput.svelte    # 日期输入组件
│   │   │   ├── Footer.svelte       # 页脚
│   │   │   ├── LocaleSwitch.svelte # 语言切换
│   │   │   ├── ThemeToggle.svelte  # 明暗主题切换
│   │   │   └── ui/                 # shadcn-svelte 组件
│   │   ├── assets/
│   │   │   └── typst/
│   │   │       ├── official-doc.typ  # 红头文件模板
│   │   │       └── tuzhang.typ       # 圆形公章生成器
│   │   ├── typst.ts                # Typst WASM 初始化与编译逻辑
│   │   ├── index.ts                # 工具函数
│   │   └── paraglide/              # i18n 生成文件
│   ├── hooks.ts                    # URL 去本地化
│   └── app.d.ts                    # 全局类型定义
├── messages/
│   ├── en.json                     # 英文本地化文本
│   └── zh.json                     # 中文本地化文本
├── static/fonts/                   # 字体文件
└── package.json
```

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查
pnpm check

# 格式化 + 检查
pnpm fl

# 构建静态站点
pnpm build
```

> [!NOTE]
> PDF 中使用的中文字体文件（仿宋、华文宋体、方正小标宋、黑体、楷体）位于 `static/fonts/` 目录，由 Typst 在初始化时以 Blob URL 的方式预加载。

## 致谢

- [ParaN3xus](https://github.com/ParaN3xus) — 红头公文 Typst 模板 (`official-doc.typ`)
- [Lonyou](https://github.com/Vkango) — 圆形公章 Typst 模板 (`tuzhang.typ`)
- [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) — [Typst](https://typst.app) WebAssembly 编译器
- [shadcn-svelte](https://www.shadcn-svelte.com) — UI 组件库

## 星标历史

[![Stargazers over time](https://starchart.cc/Naptie/endfield-docmaker.svg?variant=adaptive)](https://starchart.cc/Naptie/endfield-docmaker)