# ESPHome plus the SDL2 headers its desktop (host + sdl) display needs.
FROM esphome/esphome:stable
RUN apt-get update \
 && apt-get install -y --no-install-recommends libsdl2-dev \
 && rm -rf /var/lib/apt/lists/*
