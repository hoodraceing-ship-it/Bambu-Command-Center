# Bambu Command Center

A touch-first, standalone printer dashboard for a Fire tablet or wall display. It connects to printers already configured in [Bambuddy](https://github.com/maziggy/bambuddy), keeps credentials on the Docker server, and provides live cameras, progress, temperatures, filament, speed controls, lighting, pause/resume, and guarded print stopping.

## Display modes

The gear menu saves the selected appearance on each tablet.

- **Themes:** Bambu Dark, Arc Reactor, Workshop, and Clean Light
- **Layouts:** Command Grid, Camera Wall, Swipe Focus, and Status Rail
- **Focus mode:** tap the expand icon on any printer camera to temporarily make that printer fill the dashboard
- **Multi-printer:** Command Grid scales to three printers; Swipe Focus remains easy to use on smaller tablets

## Install

Requirements: Docker Compose, an existing Bambuddy installation, and Bambuddy API/camera tokens when authentication is enabled.

```bash
git clone https://github.com/hoodraceing-ship-it/Bambu-Command-Center.git
cd Bambu-Command-Center
cp .env.example .env
nano .env
docker compose pull
docker compose up -d
```

The defaults use automatic local-host detection:

- Dashboard: `http://<SERVER-IP>:8092`
- Bambuddy from Docker host: `http://127.0.0.1:8001`
- Bambuddy from tablet/browser: automatically derived from the dashboard address

Put credentials in `.env`; never commit that file:

```dotenv
BAMBUDDY_API_KEY=your-api-key
BAMBUDDY_CAMERA_TOKEN=your-camera-token
PORT=8092
BAMBUDDY_URL=http://127.0.0.1:8001
BAMBUDDY_BROWSER_URL=
```

Then verify:

```bash
docker compose ps
curl http://127.0.0.1:8092/health
```

## Upgrade an existing local-build installation

Keep the existing `.env`, replace the project files with this repository, and run:

```bash
docker compose down
docker compose pull
docker compose up -d
```

This changes only Bambu Command Center. Bambuddy, printer configuration, and Bambuddy data are not modified.

## Automatic updates

The repository publishes `linux/amd64` and `linux/arm64` images to GitHub Container Registry. The Compose file includes a label-restricted Watchtower service that checks every five minutes, replaces only opted-in containers, and removes the old image after a successful update.

The GHCR package must be public for anonymous Docker pulls. After the first GitHub Actions build, open the package settings once and change visibility to **Public**. Existing `.env` credentials remain local during updates.

If you do not want automatic updates, remove the `command-center-updater` service and the Watchtower label from `docker-compose.yml`. Update manually with:

```bash
docker compose pull
docker compose up -d
```

> Watchtower uses the Docker socket to replace labeled containers. Anyone with control of that updater effectively has Docker-host administrator access; keep the server and this repository account secured.

## Local development

Build the source on the current machine without running the updater:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Static assets live in `public/`; the credential-hiding proxy and web server live in `local/`.

## Fire HD 10 kiosk setup

Set Fully Kiosk Browser's start URL to `http://<SERVER-IP>:8092`, enable launch on boot, keep-screen-on, and fullscreen browsing. Keep the tablet in landscape orientation. The dashboard also supports portrait mode and horizontal swiping.

## License

MIT
