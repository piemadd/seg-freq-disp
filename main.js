import maplibregl from "maplibre-gl";
import layers from './mapStyle.json';

import './style.css';
import "maplibre-gl/dist/maplibre-gl.css";

//initializing map
const map = new maplibregl.Map({
  container: 'map',
  hash: true,
  attributionControl: false,
  style: {
    zoom: 9,
    pitch: 0,
    center: [41.8973, -87.6739],
    glyphs:
      "https://fonts.transitstat.us/_output/{fontstack}/{range}.pbf",
    sprite: "https://osml.transitstat.us/sprites/osm-liberty",
    layers: layers,
    bearing: 0,
    sources: {
      protomaps: {
        type: "vector",
        tiles: [
          "https://tilea.transitstat.us/tiles/{z}/{x}/{y}.mvt",
          "https://tileb.transitstat.us/tiles/{z}/{x}/{y}.mvt",
          "https://tilec.transitstat.us/tiles/{z}/{x}/{y}.mvt",
          "https://tiled.transitstat.us/tiles/{z}/{x}/{y}.mvt",
        ],
        maxzoom: 15,
        attribution:
          "Map Data &copy; OpenStreetMap Contributors | &copy; Transitstatus | &copy; Protomaps",
      },
    },
    version: 8,
    metadata: {},
  },
  center: [0, 0],
  zoom: 0,
  maxZoom: 20,
});

let firstStop = null;
let secondStop = null;

const firstStopElement = document.getElementById('firstStop');
const secondStopElement = document.getElementById('secondStop');
const timingsElement = document.getElementById('timings');

map.on('load', async () => {
  //adding controls
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
  map.addControl(new maplibregl.LogoControl({ compact: false }));
  map.addControl(new maplibregl.AttributionControl({ compact: false }));

  let freqDict = {};

  const freqLinesReq = await fetch('https://segfreqdata.pgm.sh/lines.geojson');
  const freqLinesData = await freqLinesReq.json();

  for (let i = 0; i < freqLinesData.features.length; i++) {
    const feature = freqLinesData.features[i];

    freqDict[feature.id] = feature;
  }

  const stopsReq = await fetch('https://segfreqdata.pgm.sh/stops.geojson');
  const stopsData = await stopsReq.json();

  //adding lines
  map.addSource('freq-lines', {
    type: 'geojson',
    data: freqLinesData
  });

  map.addSource('stops', {
    type: 'geojson',
    data: stopsData
  })

  map.addLayer({
    'id': 'freq-lines',
    'type': 'line',
    'source': 'freq-lines',
    'paint': {
      'line-width': 2,
      'line-color': '#de3a3a'
    }
  });

  map.addLayer({
    'id': 'stops',
    'type': 'circle',
    'source': 'stops',
    'paint': {
      'circle-radius': 8,
      'circle-color': '#5b9beb'
    }
  });

  map.on('click', 'stops', (e) => {
    if (e.features.length < 1) console.error('Not a stop');

    if (!firstStop) {
      firstStop = e.features[0];
      console.log('First stop:', firstStop.properties)
      firstStopElement.innerText = `First Stop: ${firstStop.properties.name} (${firstStop.properties.stopID})`;
      secondStopElement.innerText = 'Second Stop: Not Set';
      timingsElement.innerHTML = '';
      if (map.getLayer('res')) {
        map.removeLayer('res');
        map.removeSource('res');
      }
      return;
    }
    if (!secondStop) {
      secondStop = e.features[0];
      console.log('Second stop:', secondStop.properties)
      secondStopElement.innerText = `Second Stop: ${secondStop.properties.name} (${secondStop.properties.stopID})`

      const queried = map.querySourceFeatures('freq-lines', {
        filter: ["==", ['get', 'segment'], `${firstStop.properties.stopID}_${secondStop.properties.stopID}`]
      })

      firstStop = null;
      secondStop = null;

      if (queried.length < 1) {
        console.error('Not a valid stop pair');
        timingsElement.innerHTML = '<p>There is no service between these two stops.</p>'
        return;
      }

      const res = queried[0];

      const resData = freqDict[res.properties.segment];
      const resTimings = JSON.parse(res.properties.timings);

      map.addSource('res', {
        type: 'geojson',
        data: resData
      })

      map.addLayer({
        'id': 'res',
        'type': 'line',
        'source': 'res',
        'paint': {
          'line-width': 2,
          'line-color': '#6bcc50'
        }
      });

      let timingsHTML = '<ul>';
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const hours = Array.from(Array(24).keys()).map((n) => n.toString().padStart(2, "0"));

      days.forEach((day) => {
        let dayHTML = `<li>${day}:<ul>`;

        hours.forEach((hour) => {
          dayHTML += `<li>${hour}:00 - ${hour}:59: ${resTimings[day][hour]}</li>`;
        })

        dayHTML += '</ul></li>';
        timingsHTML += dayHTML;
      })

      timingsHTML += '</ul>';
      timingsElement.innerHTML = timingsHTML;
      console.log(timingsHTML)
    }

  })
})