![ConvertX-extend](images/logo.png)

# ConvertX-extend

ConvertX-extend is an extended self-hosted online file converter based on the original [ConvertX](https://github.com/C4illin/ConvertX). It supports converting files across many document, image, audio, video, archive, e-book, vector, and 3D formats.

## Features

- Convert files to different formats
- Process multiple files at once
- Password protection
- Multiple accounts
- Chinese UI text adjustments
- Docker image build and Docker Hub publishing workflow

## Deployment

> [!WARNING]
> If you cannot log in, make sure you are accessing the service over `localhost` or HTTPS. For local HTTP access, set `HTTP_ALLOWED=true`.

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

Or run it directly:

```bash
docker run -p 3000:3000 -v ./data:/app/data <dockerhub-username>/convertx-extend:latest
```

Then visit `http://localhost:3000` and create the first account.

If you get an `unable to open database file` error, fix the mounted data directory permissions:

```bash
chown -R "$USER:$USER" ./data
```

## Local Docker Build

```bash
docker compose up --build
```

The included `compose.yaml` builds the local image as `convertx-extend:latest` and serves the app on `${CONVERTX_PORT:-3000}`.

## Docker Hub Publishing

The GitHub Actions workflow `.github/workflows/docker-publish.yml` builds multi-architecture images for `linux/amd64` and `linux/arm64`, then pushes to Docker Hub on `main`, version tags, or manual workflow dispatch.

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

If `DOCKERHUB_IMAGE` is not set, the image is:

```text
DOCKERHUB_USERNAME/convertx-extend
```

## Environment Variables

All variables are optional except `JWT_SECRET`, which is strongly recommended for any persistent deployment.

| Name                         | Default                                            | Description                                                                 |
| ---------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `JWT_SECRET`                 | random UUID when unset                            | Secret used to sign JSON Web Tokens                                         |
| `ACCOUNT_REGISTRATION`       | `false`                                            | Allow users to register accounts                                            |
| `HTTP_ALLOWED`               | `false`                                            | Allow HTTP connections. Use only for trusted local deployments              |
| `ALLOW_UNAUTHENTICATED`      | `false`                                            | Allow unauthenticated users to use the service                              |
| `AUTO_DELETE_EVERY_N_HOURS`  | `24`                                               | Delete files older than this number of hours. Set `0` to disable            |
| `WEBROOT`                    | empty                                              | Serve the app from a sub-path, for example `/convert`                       |
| `FFMPEG_ARGS`                | empty                                              | Extra arguments passed to ffmpeg input                                      |
| `FFMPEG_OUTPUT_ARGS`         | empty                                              | Extra arguments passed to ffmpeg output                                     |
| `HIDE_HISTORY`               | `false`                                            | Hide the history page                                                       |
| `LANGUAGE`                   | `en`                                               | BCP 47 language tag used for date formatting                                |
| `UNAUTHENTICATED_USER_SHARING` | `false`                                          | Share conversion history between unauthenticated users                      |
| `MAX_CONVERT_PROCESS`        | `0`                                                | Maximum concurrent conversion processes. Set `0` for unlimited              |

## Development

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

## Supported Converters

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

## Screenshots

![ConvertX-extend Preview](images/preview.png)

## Upstream

This project is based on [C4illin/ConvertX](https://github.com/C4illin/ConvertX). Upstream documentation, issues, and release history may still be useful when working on converter behavior.
