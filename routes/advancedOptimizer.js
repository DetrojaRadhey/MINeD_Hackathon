const xlsx = require('xlsx');
const turf = require('@turf/turf');
const fs = require('fs');

// Store coordinates (Depot Location)
const STORE_LOCATION = [19.075887, 72.877911];

// Vehicle constraints
const VEHICLE_INFO = {
    "4W": { capacity: 25, radius: Infinity, speed: 50 },
    "4W-EV": { capacity: 8, radius: 20, speed: 40 },
    "3W": { capacity: 5, radius: 15, speed: 30 }
};

// Load data from Excel
function loadData(file) {
    const workbook = xlsx.readFile(file.path);
    const shipments = xlsx.utils.sheet_to_json(workbook.Sheets['Shipments_Data'], {
        header: ['Shipment_ID', 'Latitude', 'Longitude', 'Delivery_Timeslot'],
        range: 1 // Skip header row
    }).slice(0, 50);
    
    const vehicles = xlsx.utils.sheet_to_json(workbook.Sheets['Vehicle_Information']);
    return { shipments, vehicles };
}

// Create clusters based on distance
function createClusters(shipments) {
    const clusters = [];
    const clusterColors = [];

    shipments.forEach(shipment => {
        const storeDistance = turf.distance(STORE_LOCATION, [shipment.Latitude, shipment.Longitude]);
        const radius = storeDistance > 12 ? 8 : (storeDistance > 8 ? 3 : 3);

        let added = false;
        for (const cluster of clusters) {
            if (cluster.some(s => turf.distance([s.Latitude, s.Longitude], [shipment.Latitude, shipment.Longitude]) < radius)) {
                cluster.push(shipment);
                added = true;
                break;
            }
        }

        if (!added) {
            clusters.push([shipment]);
            const color = storeDistance > 10 ? 'red' : (storeDistance > 7.5 ? 'green' : 'blue');
            clusterColors.push(color);
        }
    });

    return { clusters, clusterColors };
}

// Process optimization
async function processAdvancedOptimization(file) {
    try {
        const { shipments, vehicles } = loadData(file);
        const { clusters, clusterColors } = createClusters(shipments);
        const vehicleTrips = [];
        let tripCounter = 1;

        clusters.forEach((cluster, i) => {
            const sortedShipments = cluster.sort((a, b) => 
                turf.distance(STORE_LOCATION, [a.Latitude, a.Longitude]) - 
                turf.distance(STORE_LOCATION, [b.Latitude, b.Longitude])
            );

            const vehicleType = clusterColors[i] === 'red' ? '4W' : 
                              (clusterColors[i] === 'green' ? '4W-EV' : '3W');
            const { capacity, radius, speed } = VEHICLE_INFO[vehicleType];

            let tripShipments = [];
            let tripDistance = 0;
            let tripFarthestDistance = 0;

            sortedShipments.forEach(shipment => {
                const shipmentDistance = turf.distance(STORE_LOCATION, [shipment.Latitude, shipment.Longitude]);
                const returnTripDistance = shipmentDistance * 2;

                if (tripShipments.length >= capacity || tripFarthestDistance + shipmentDistance > radius) {
                    const tripTime = ((tripDistance / speed) * 60).toFixed(2);
                    const capacityUtilization = ((tripShipments.length / capacity) * 100).toFixed(2);
                    const timeUtilization = ((tripTime / 480) * 100).toFixed(2);
                    const coverageUtilization = radius !== Infinity ? 
                        ((tripFarthestDistance / radius) * 100).toFixed(2) : 100;

                    vehicleTrips.push({
                        tripCounter,
                        tripShipments,
                        tripDistance,
                        tripTime,
                        vehicleType,
                        capacityUtilization,
                        timeUtilization,
                        coverageUtilization
                    });

                    tripCounter++;
                    tripShipments = [];
                    tripFarthestDistance = 0;
                    tripDistance = 0;
                }

                tripShipments.push({
                    Shipment_ID: shipment.Shipment_ID,
                    Latitude: shipment.Latitude,
                    Longitude: shipment.Longitude,
                    Delivery_Timeslot: shipment.Delivery_Timeslot || 'N/A'
                });
                tripFarthestDistance += shipmentDistance;
                tripDistance += returnTripDistance;
            });

            if (tripShipments.length > 0) {
                const tripTime = ((tripDistance / speed) * 60).toFixed(2);
                const capacityUtilization = ((tripShipments.length / capacity) * 100).toFixed(2);
                const timeUtilization = ((tripTime / 480) * 100).toFixed(2);
                const coverageUtilization = radius !== Infinity ? 
                    ((tripFarthestDistance / radius) * 100).toFixed(2) : 100;

                vehicleTrips.push({
                    tripCounter,
                    tripShipments,
                    tripDistance,
                    tripTime,
                    vehicleType,
                    capacityUtilization,
                    timeUtilization,
                    coverageUtilization
                });

                tripCounter++;
            }
        });

        // Generate map
        const mapContent = generateMap(vehicleTrips);
        fs.writeFileSync('public/maps/Optimized_Trips_Map.html', mapContent);

        return {
            success: true,
            message: 'Optimization completed successfully!',
            mapFile: 'Optimized_Trips_Map.html',
            trips: vehicleTrips.map(trip => ({
                tripCounter: trip.tripCounter,
                tripShipments: trip.tripShipments.map(shipment => ({
                    Shipment_ID: shipment.Shipment_ID || 'N/A',
                    Latitude: shipment.Latitude,
                    Longitude: shipment.Longitude,
                    Delivery_Timeslot: shipment.Delivery_Timeslot || 'N/A'
                })),
                tripDistance: parseFloat(trip.tripDistance),
                tripTime: trip.tripTime,
                vehicleType: trip.vehicleType,
                capacityUtilization: trip.capacityUtilization,
                timeUtilization: trip.timeUtilization,
                coverageUtilization: trip.coverageUtilization
            })),
            vehicleInfo: VEHICLE_INFO
        };
    } catch (error) {
        console.error('Optimization Error:', error);
        return {
            success: false,
            message: 'Error processing optimization'
        };
    }
}

// Generate map HTML
function generateMap(trips) {
    const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'gray'];
    let mapContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Optimized Trips Map</title>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>#map { height: 500px; }</style>
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
    `;

    trips.forEach((trip, index) => {
        const color = colors[index % colors.length];
        const coordinates = [
            STORE_LOCATION,
            ...trip.tripShipments.map(s => [s.Latitude, s.Longitude]),
            STORE_LOCATION
        ];

        mapContent += `
            L.polyline(${JSON.stringify(coordinates)}, { color: "${color}" })
                .bindPopup('Trip ${trip.tripCounter}')
                .addTo(map);
        `;

        trip.tripShipments.forEach(shipment => {
            mapContent += `
                L.circleMarker([${shipment.Latitude}, ${shipment.Longitude}], {
                    color: "${color}",
                    radius: 6
                })
                .bindPopup('Shipment: ${shipment.Shipment_ID}')
                .addTo(map);
            `;
        });
    });

    mapContent += `
            </script>
        </body>
        </html>
    `;

    return mapContent;
}

module.exports = { processAdvancedOptimization }; 