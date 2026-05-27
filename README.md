![ConvertX-extend](images/logo.png)

# ConvertX-extend

## 中文说明

ConvertX-extend 是基于原版 [ConvertX](https://github.com/C4illin/ConvertX) 修改的自托管在线文件转换工具。它可以在浏览器里转换文档、图片、音频、视频、压缩包、电子书、矢量图和 3D 文件等多种格式。

这个版本主要做了这些调整：

- 调整项目名为 `ConvertX-extend`
- 优化中文界面文案
- 增加图片大小设置
- 增加 Docker Hub 镜像打包和推送 workflow
- 增加中文注释的 `.env.example`
- 精简上游仓库中暂时用不上的配置文件和 workflow

### 为什么没有 fork

这个项目确实是基于原版 ConvertX 修改的，但我没有把 GitHub 仓库做成 fork。

原因也很简单：有点强迫症。fork 之后，只要上游有更新，GitHub 页面就会一直提示有新的上游变更，看到了就很想点同步。但这个项目已经做了自己的调整，直接同步上游可能会带来兼容问题，所以干脆不 fork，避免被提示干扰。

项目里仍然保留了 `upstream` 的概念，需要同步原版时可以手动处理。

### 部署

> [!WARNING]
> 如果无法登录，请确认访问地址是 `localhost` 或 HTTPS。本地 HTTP 部署时可以设置 `HTTP_ALLOWED=true`。

推荐使用 `compose.yaml` 配合 `.env` 启动：

```bash
cp .env.example .env
docker compose up -d --build
```

也可以直接参考下面的 Compose 配置：

```yml
services:
  convertx-extend:
    image: <dockerhub-username>/convertx-extend:latest
    container_name: convertx-extend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      JWT_SECRET: "aLongAndSecretStringUsedToSignTheJSONWebToken1234"
      HTTP_ALLOWED: "true"
      TZ: "Asia/Shanghai"
    volumes:
      - ./data:/app/data
```

启动后访问：

```text
http://localhost:3000
```

第一次进入时创建管理员账户。不要在公网环境下把未初始化的服务直接暴露出去。

如果遇到 `unable to open database file`，通常是数据目录权限问题：

```bash
chown -R "$USER:$USER" ./data
```

### 本地构建 Docker 镜像

```bash
docker compose up --build
```

当前 `compose.yaml` 会构建本地镜像 `convertx-extend:latest`，默认端口是 `${CONVERTX_PORT:-3000}`。

### 推送到 Docker Hub

`.github/workflows/docker-publish.yml` 会构建 `linux/amd64` 和 `linux/arm64` 多架构镜像，并在推送到 `main`、推送版本 tag 或手动触发 workflow 时发布到 Docker Hub。

需要在 GitHub 仓库设置里配置：

| 名称                 | 类型                | 必需 | 说明                                      |
| -------------------- | ------------------- | ---- | ----------------------------------------- |
| `DOCKERHUB_USERNAME` | Repository variable | 是   | Docker Hub 用户名或组织名                 |
| `DOCKERHUB_TOKEN`    | Repository secret   | 是   | Docker Hub Access Token                   |
| `DOCKERHUB_IMAGE`    | Repository variable | 否   | 镜像名，不设置时默认为 `convertx-extend` |

最终镜像名是：

```text
DOCKERHUB_USERNAME/DOCKERHUB_IMAGE
```

如果没有设置 `DOCKERHUB_IMAGE`，则是：

```text
DOCKERHUB_USERNAME/convertx-extend
```

### 环境变量

大部分变量都是可选的，但正式部署时强烈建议设置 `JWT_SECRET`。

| 名称                           | 默认值                 | 说明                                                     |
| ------------------------------ | ---------------------- | -------------------------------------------------------- |
| `JWT_SECRET`                   | 未设置时使用随机 UUID | JWT 签名密钥，生产环境必须改成足够长的随机字符串        |
| `ACCOUNT_REGISTRATION`         | `false`                | 是否允许用户自行注册                                    |
| `HTTP_ALLOWED`                 | `false`                | 是否允许 HTTP 访问，本地部署可设为 `true`               |
| `ALLOW_UNAUTHENTICATED`        | `false`                | 是否允许未登录用户使用转换功能                          |
| `AUTO_DELETE_EVERY_N_HOURS`    | `24`                   | 自动清理文件的间隔小时数，设为 `0` 可关闭               |
| `WEBROOT`                      | 空                     | 应用子路径，例如 `/convert`                             |
| `FFMPEG_ARGS`                  | 空                     | 传给 ffmpeg 输入端的额外参数                            |
| `FFMPEG_OUTPUT_ARGS`           | 空                     | 传给 ffmpeg 输出端的额外参数                            |
| `HIDE_HISTORY`                 | `false`                | 是否隐藏历史记录页面                                    |
| `LANGUAGE`                     | `en`                   | 日期格式化语言，使用 BCP 47 语言标签                    |
| `UNAUTHENTICATED_USER_SHARING` | `false`                | 未登录用户之间是否共享转换历史                          |
| `MAX_CONVERT_PROCESS`          | `0`                    | 最大并发转换进程数量，`0` 表示不限制                    |

### 开发

安装 [Bun](https://bun.sh/) 后运行：

```bash
bun install
bun run dev
```

常用检查：

```bash
bun run build
bun run lint
```

### 支持的转换器

ConvertX-extend 继承了 ConvertX 的转换器体系，包括：

- Inkscape
- libjxl
- resvg
- Vips
- libheif
- XeLaTeX
- Calibre
- LibreOffice
- Dasel
- Pandoc
- msgconvert
- dvisvgm
- ImageMagick
- GraphicsMagick
- Assimp
- FFmpeg
- Potrace
- VTracer
- Markitdown

### 截图

![ConvertX-extend Preview](images/preview.png)

### 上游项目

本项目基于 [C4illin/ConvertX](https://github.com/C4illin/ConvertX)。如果遇到转换器行为、依赖或格式支持相关问题，上游文档和 issue 仍然有参考价值。

---

## English

ConvertX-extend is a modified self-hosted online file converter based on the original [ConvertX](https://github.com/C4illin/ConvertX). It supports converting documents, images, audio, video, archives, e-books, vector graphics, 3D files, and many other formats in the browser.

This version mainly includes:

- Project rename to `ConvertX-extend`
- Chinese UI copy adjustments
- Image size options
- Docker Hub image build and publish workflow
- Chinese-commented `.env.example`
- Removal of upstream files and workflows that are not needed here

### Why This Repository Is Not a Fork

This project is based on ConvertX, but the GitHub repository is intentionally not a fork.

The reason is practical and a little personal: once a repository is a fork, GitHub keeps showing upstream update prompts. That makes it tempting to click sync whenever upstream changes. Since this project has its own changes, direct upstream sync can introduce compatibility issues, so this repository is kept as a standalone repo.

The upstream relationship is still acknowledged, and upstream changes can be pulled manually when needed.

### Deployment

> [!WARNING]
> If you cannot log in, make sure you are accessing the service over `localhost` or HTTPS. For local HTTP access, set `HTTP_ALLOWED=true`.

Recommended startup:

```bash
cp .env.example .env
docker compose up -d --build
```

Example Compose service:

```yml
services:
  convertx-extend:
    image: <dockerhub-username>/convertx-extend:latest
    container_name: convertx-extend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      JWT_SECRET: "aLongAndSecretStringUsedToSignTheJSONWebToken1234"
      HTTP_ALLOWED: "true"
      TZ: "Asia/Shanghai"
    volumes:
      - ./data:/app/data
```

Then open:

```text
http://localhost:3000
```

Create the first account on first launch. Do not expose an unconfigured instance publicly.

If you get `unable to open database file`, fix the data directory permissions:

```bash
chown -R "$USER:$USER" ./data
```

### Local Docker Build

```bash
docker compose up --build
```

The included `compose.yaml` builds `convertx-extend:latest` and serves the app on `${CONVERTX_PORT:-3000}`.

### Docker Hub Publishing

`.github/workflows/docker-publish.yml` builds multi-architecture images for `linux/amd64` and `linux/arm64`, then pushes to Docker Hub on `main`, version tags, or manual workflow dispatch.

Configure these in GitHub repository settings:

| Name                 | Type                    | Required | Description                                      |
| -------------------- | ----------------------- | -------- | ------------------------------------------------ |
| `DOCKERHUB_USERNAME` | Repository variable     | Yes      | Docker Hub username or organization namespace    |
| `DOCKERHUB_TOKEN`    | Repository secret       | Yes      | Docker Hub access token                          |
| `DOCKERHUB_IMAGE`    | Repository variable     | No       | Docker Hub image name. Defaults to `convertx-extend` |

The published image name is:

```text
DOCKERHUB_USERNAME/DOCKERHUB_IMAGE
```

If `DOCKERHUB_IMAGE` is not set:

```text
DOCKERHUB_USERNAME/convertx-extend
```

### Environment Variables

Most variables are optional, but `JWT_SECRET` is strongly recommended for persistent deployments.

| Name                           | Default                  | Description                                                                 |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------- |
| `JWT_SECRET`                   | random UUID when unset   | Secret used to sign JSON Web Tokens                                         |
| `ACCOUNT_REGISTRATION`         | `false`                  | Allow users to register accounts                                            |
| `HTTP_ALLOWED`                 | `false`                  | Allow HTTP connections. Use only for trusted local deployments              |
| `ALLOW_UNAUTHENTICATED`        | `false`                  | Allow unauthenticated users to use the service                              |
| `AUTO_DELETE_EVERY_N_HOURS`    | `24`                     | Delete files older than this number of hours. Set `0` to disable            |
| `WEBROOT`                      | empty                    | Serve the app from a sub-path, for example `/convert`                       |
| `FFMPEG_ARGS`                  | empty                    | Extra arguments passed to ffmpeg input                                      |
| `FFMPEG_OUTPUT_ARGS`           | empty                    | Extra arguments passed to ffmpeg output                                     |
| `HIDE_HISTORY`                 | `false`                  | Hide the history page                                                       |
| `LANGUAGE`                     | `en`                     | BCP 47 language tag used for date formatting                                |
| `UNAUTHENTICATED_USER_SHARING` | `false`                  | Share conversion history between unauthenticated users                      |
| `MAX_CONVERT_PROCESS`          | `0`                      | Maximum concurrent conversion processes. Set `0` for unlimited              |

### Development

Install [Bun](https://bun.sh/) and run:

```bash
bun install
bun run dev
```

Useful checks:

```bash
bun run build
bun run lint
```

### Supported Converters

ConvertX-extend inherits the converter set from ConvertX, including:

- Inkscape
- libjxl
- resvg
- Vips
- libheif
- XeLaTeX
- Calibre
- LibreOffice
- Dasel
- Pandoc
- msgconvert
- dvisvgm
- ImageMagick
- GraphicsMagick
- Assimp
- FFmpeg
- Potrace
- VTracer
- Markitdown

### Screenshots

![ConvertX-extend Preview](images/preview.png)

### Upstream

This project is based on [C4illin/ConvertX](https://github.com/C4illin/ConvertX). Upstream documentation, issues, and release history may still be useful when working on converter behavior.
