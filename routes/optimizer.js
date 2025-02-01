require('dotenv').config(); // Load environment variables from .env
const fs = require('fs');
const xlsx = require('xlsx');
const googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_MAPS_API_KEY,
  Promise: Promise,
});
const turf = require('@turf/turf');

const TRAVEL_TIME_PER_KM = 5; // minutes per km
const DELIVERY_TIME_PER_SHIPMENT = 10; // minutes
const STORE_LOCATION = [19.075887, 72.877911];

function loadData(file) {
  const workbook = xlsx.readFile(file.path);
  const shipmentsSheet = xlsx.utils.sheet_to_json(
    workbook.Sheets["Shipments_Data"]
  );
  const vehiclesSheet = xlsx.utils.sheet_to_json(
    workbook.Sheets["Vehicle_Information"]
  );
  
  // Ensure each shipment has a Shipment_ID
  const shipments = shipmentsSheet.slice(0, 20).map((shipment, index) => ({
    ...shipment,
    Shipment_ID: shipment.Shipment_ID || `SHIP${String(index + 1).padStart(3, '0')}`
  }));
  
  return { shipments, vehicles: vehiclesSheet };
}

function haversineDistance(coord1, coord2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lat1, lon1] = coord1.map(toRad);
  const [lat2, lon2] = coord2.map(toRad);
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getDrivingDistance(origin, destination) {
  try {
    const response = await googleMapsClient
      .directions({ origin, destination, mode: "driving" })
      .asPromise();
    return response.json.routes[0].legs[0].distance.value / 1000;
  } catch (error) {
    console.error(`Error fetching distance: ${error}`);
    return Infinity;
  }
}

function clusterShipments(shipments, numClusters) {
  const clusters = [];
  const clusterSize = Math.ceil(shipments.length / numClusters);

  shipments.sort((a, b) => {
    const distA = haversineDistance(STORE_LOCATION, [a.Latitude, a.Longitude]);
    const distB = haversineDistance(STORE_LOCATION, [b.Latitude, b.Longitude]);
    return distA - distB;
  });

  for (let i = 0; i < shipments.length; i++) {
    const clusterId = Math.floor(i / clusterSize);
    shipments[i].Cluster = clusterId;
  }

  return shipments;
}

async function assignVehicles(shipments, vehicles) {
  vehicles.sort((a, b) => a.Shipments_Capacity - b.Shipments_Capacity);
  const numClusters = Math.min(shipments.length, vehicles.length);
  shipments = clusterShipments(shipments, numClusters);
  const groupedShipments = {};
  shipments.forEach((s) => {
    if (!groupedShipments[s.Cluster]) groupedShipments[s.Cluster] = [];
    groupedShipments[s.Cluster].push(s);
  });

  const trips = [];
  let tripId = 1;

  for (const [clusterId, group] of Object.entries(groupedShipments)) {
    let remainingShipments = [...group];
    for (const vehicle of vehicles) {
      if (!remainingShipments.length) break;
      const selectedShipments = remainingShipments.splice(0, vehicle.Shipments_Capacity);
      let actualDist = await getDrivingDistance(STORE_LOCATION, [selectedShipments[0].Latitude, selectedShipments[0].Longitude]);
      for (let i = 0; i < selectedShipments.length - 1; i++) {
        actualDist += await getDrivingDistance(
          [selectedShipments[i].Latitude, selectedShipments[i].Longitude],
          [selectedShipments[i + 1].Latitude, selectedShipments[i + 1].Longitude]
        );
      }
      actualDist += await getDrivingDistance([selectedShipments[selectedShipments.length - 1].Latitude, selectedShipments[selectedShipments.length - 1].Longitude], STORE_LOCATION);
      const tripTime = actualDist * TRAVEL_TIME_PER_KM + selectedShipments.length * DELIVERY_TIME_PER_SHIPMENT;
      trips.push({
        TRIP_ID: tripId++,
        Shipments: selectedShipments,
        Cluster: clusterId,
        ACTUAL_DIST: actualDist,
        TRIP_TIME: tripTime,
        Vehicle_Type: vehicle["Vehicle Type"],
      });
    }
  }
  return trips;
}

function saveOutput(trips) {
  const workbook = xlsx.utils.book_new();
  const worksheetData = trips.map((trip) => ({
    TRIP_ID: trip.TRIP_ID,
    Shipments: trip.Shipments.map((s) => s.Shipment_ID).join(', '),
    Cluster: trip.Cluster,
    ACTUAL_DIST: trip.ACTUAL_DIST.toFixed(2),
    TRIP_TIME: trip.TRIP_TIME.toFixed(2),
    Vehicle_Type: trip.Vehicle_Type,
  }));
  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  xlsx.utils.book_append_sheet(workbook, worksheet, "Optimized Trips");
  xlsx.writeFile(workbook, "public/downloads/Optimized_Trip_Output.xlsx");
}

function plotTrips(trips) {
  const colors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", 
    "#800000", "#008000", "#000080", "#808000", "#800080", "#008080"
  ];

  const mapContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Optimized Trips Map</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        #map { height: 500px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map').setView([${STORE_LOCATION[0]}, ${STORE_LOCATION[1]}], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        L.marker([${STORE_LOCATION[0]}, ${STORE_LOCATION[1]}])
          .bindPopup('Store Location')
          .addTo(map);

        ${trips
          .map((trip, index) => {
            const color = colors[index % colors.length];
            const tripCoordinates = [
              [STORE_LOCATION[0], STORE_LOCATION[1]],
              ...trip.Shipments.map((shipment) => [shipment.Latitude, shipment.Longitude]),
              [STORE_LOCATION[0], STORE_LOCATION[1]]
            ];

            return `
              L.polyline(${JSON.stringify(tripCoordinates)}, { color: "${color}" })
                .bindPopup('Trip ID: ${trip.TRIP_ID}, Shipments: ${trip.Shipments.map(s => s.Shipment_ID).join(", ")}')
                .addTo(map);

              ${trip.Shipments
                .map((shipment) =>
                  shipment.Latitude && shipment.Longitude
                    ? `L.marker([${shipment.Latitude}, ${shipment.Longitude}])
                        .bindPopup('Shipment ID: ${shipment.Shipment_ID}, Trip ID: ${trip.TRIP_ID}')
                        .addTo(map);`
                    : ''
                )
                .join('')}
            `;
          })
          .join('')}
      </script>
    </body>
    </html>
  `;

  fs.writeFileSync("public/maps/Optimized_Trips_Map.html", mapContent);
}

async function processOptimization(file) {
  try {
    const { shipments, vehicles } = loadData(file);
    const trips = await assignVehicles(shipments, vehicles);
    saveOutput(trips);
    plotTrips(trips);
    return {
      success: true,
      message: "Trips created successfully!",
      mapFile: "Optimized_Trips_Map.html",
      outputFile: "Optimized_Trip_Output.xlsx"
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Error processing optimization"
    };
  }
}

module.exports = { processOptimization };