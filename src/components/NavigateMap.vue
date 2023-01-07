<template>
  <div>
    <div
      class="stat"
      v-if="route.start && route.end && route.distance && route.path"
    >
      <div class="start-point">Начальная точка: {{ route.start }}</div>
      <div class="end-point">Конечная точка: {{ route.end }}</div>
      <div class="distance">Длина пути: {{ route.distance }} метров</div>
      <div class="route">Путь: {{ route.path.join(" > ") }}</div>
    </div>
    <div class="actions">
      <button
        @click="setCreatingMarkers"
        v-text="
          mode === 'markers' ? 'Закончить добавление' : 'Добавить вершины'
        "
      />
      <button
        @click="setCreatingLines"
        v-text="mode === 'lines' ? 'Закончить добавление' : 'Проложить рёбра'"
      />
      <button @click="createRoute" v-text="createRouteText" />
    </div>
    <l-map
      id="map"
      :zoom="zoom"
      :center="center"
      @click="editMap"
      @mousemove="onMousemoveOnMap"
    >
      <l-tile-layer :url="url" :attribution="attribution" />
      <l-marker
        v-for="(marker, mIdx) of markers"
        :key="JSON.stringify(marker)"
        :latLng="marker"
        :markerOptions="{
          title: 'title',
        }"
        @click="onMarkerClick"
      >
        <l-tooltip
          :options="{
            permanent: true,
          }"
          >{{ mIdx + 1 }}</l-tooltip
        >
      </l-marker>
      <l-polyline
        v-if="tempMarker && cursorLatLng"
        :lat-lngs="[tempMarker, cursorLatLng]"
        color="green"
      />
      <l-polyline
        v-for="line of polylines"
        :key="JSON.stringify(line)"
        :lat-lngs="line"
        color="red"
      />
      <l-polyline
        v-if="route.pathLine"
        :lat-lngs="route.pathLine"
        color="green"
      />
    </l-map>
  </div>
</template>

<script>
import { LMap, LTileLayer, LMarker, LPolyline, LTooltip } from "vue2-leaflet";
import * as turf from "@turf/turf";
import { DijkstraPathFinder } from "@/services/DijkstraPathFinder";
const mode = {
  SHOW_MAP: "show",
  CREATE_MARKERS: "markers",
  CREATE_LINES: "lines",
  CREATE_ROUTE_START: "route-start",
  CREATE_ROUTE_END: "route-end",
};

export default {
  name: "NavigateMap",
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LPolyline,
    LTooltip,
  },
  data() {
    return {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a target="_blank" href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      zoom: 16,
      center: [56.3287, 44.002],
      markers: [],
      mode: mode.SHOW_MAP,
      tempMarker: null,
      cursorLatLng: null,
      polylines: [],
      graph: {},
      route: {
        start: null,
        end: null,
        pathLine: null,
        distance: null,
        path: null,
      },
    };
  },
  computed: {
    createRouteText() {
      if (this.mode === mode.CREATE_ROUTE_START) {
        return "Укажите начальную точку";
      }
      if (this.mode === mode.CREATE_ROUTE_END) {
        return "Укажите конечную точку";
      }
      return "Построить маршрут";
    },
  },
  methods: {
    createRoute() {
      if (this.mode === mode.CREATE_ROUTE_START) {
        this.mode = mode.CREATE_ROUTE_END;
        return;
      }
      if (this.mode === mode.CREATE_ROUTE_END) {
        this.mode = mode.SHOW_MAP;

        const { start, end } = this.route;
        const startIdx =
          this.markers.findIndex(
            (m) => JSON.stringify(m) === JSON.stringify(start)
          ) + 1;
        const endIdx =
          this.markers.findIndex(
            (m) => JSON.stringify(m) === JSON.stringify(end)
          ) + 1;
        const pathFinder = new DijkstraPathFinder(this.graph, startIdx, endIdx);
        const route = pathFinder.findPath();

        const routeLine = route.path?.map((point) =>
          this.markers.find((m, mIdx) => mIdx === Number(point) - 1)
        );
        this.route = {
          start: startIdx,
          end: endIdx,
          distance: route.distance,
          pathLine: routeLine,
          path: route.path,
        };
        return;
      }
      this.mode = mode.CREATE_ROUTE_START;
      this.route = {};
    },
    editMap({ latlng }) {
      if (this.mode === mode.CREATE_MARKERS) {
        this.markers = [...this.markers, latlng];
      }
    },
    setCreatingMarkers() {
      if (this.mode === mode.CREATE_MARKERS) {
        this.mode = mode.SHOW_MAP;
        return;
      }
      this.mode = mode.CREATE_MARKERS;
    },
    setCreatingLines() {
      if (this.mode === mode.CREATE_LINES) {
        this.mode = mode.SHOW_MAP;
        this.tempMarker = null;
        this.cursorLatLng = null;

        this.markers.forEach((m, mIdx) => {
          this.graph[mIdx + 1] = {};
        });

        this.polylines.forEach((p) => {
          const stringLine = JSON.stringify(p[0]);
          const fLineIdx =
            this.markers.findIndex((m) => JSON.stringify(m) === stringLine) + 1;

          this.polylines
            .filter((polyline) => JSON.stringify(polyline[0]) === stringLine)
            .forEach(([pStart, eEnd]) => {
              const stringPairLine = JSON.stringify(eEnd);

              const sLineIdx =
                this.markers.findIndex(
                  (m) => JSON.stringify(m) === stringPairLine
                ) + 1;

              const pointStart = turf.point([pStart.lat, pStart.lng]);
              const pointEnd = turf.point([eEnd.lat, eEnd.lng]);
              this.graph[fLineIdx][sLineIdx] = Number.parseInt(
                turf.distance(pointStart, pointEnd, { units: "kilometers" }) *
                  1000
              );
            });
        });

        return;
      }
      this.mode = mode.CREATE_LINES;
    },
    onMousemoveOnMap({ latlng }) {
      if (this.mode !== mode.CREATE_LINES) return;
      this.cursorLatLng = latlng;
    },
    onMarkerClick({ latlng }) {
      if (this.mode === mode.CREATE_LINES) {
        if (this.tempMarker) {
          const newLine = [this.tempMarker, latlng];
          this.polylines = [...this.polylines, newLine];
        }
        this.tempMarker = latlng;
      }
      if (this.mode === mode.CREATE_ROUTE_START) {
        this.route = {
          ...this.route,
          start: latlng,
        };
        return;
      }
      if (this.mode === mode.CREATE_ROUTE_END) {
        this.route = {
          ...this.route,
          end: latlng,
        };
        return;
      }
    },
  },
};
</script>

<style scoped>
#map {
  width: 100%;
  height: 700px;
  cursor: pointer;
}
.stat {
  width: 400px;
  height: 150px;
  position: absolute;
  top: 60px;
  left: 60px;
  z-index: 1000;
  background-color: whitesmoke;
}
.actions {
  position: absolute;
  z-index: 1000;
  right: 40px;
  top: 40px;
}
</style>
