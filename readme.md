# Optimizer Project

## Overview
The Optimizer Project is a Node.js application that optimizes delivery routes based on shipment data. It utilizes various libraries to read shipment and vehicle information from Excel files, calculate distances, and generate optimized trip plans. The application also provides a visual representation of the optimized routes on a map.

## Features
- Load shipment and vehicle data from Excel files.
- Calculate distances using the Google Maps API.
- Optimize delivery routes based on vehicle capacity and shipment locations.
- Generate an output with optimized trip details.
- Create an HTML map displaying the optimized routes.

## Technologies Used
- Node.js
- Express.js
- dotenv
- xlsx
- @google/maps
- Turf.js
- Leaflet.js

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/optimizer-project.git
   cd optimizer-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file:**
   Create a `.env` file in the root directory of the project and add your Google Maps API key:
   ```plaintext
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. **Create a `.gitignore` file:**
   Ensure you have a `.gitignore` file to exclude sensitive files and directories:
   ```plaintext
   node_modules/
   uploads/
   public/maps/
   .env
   ```

## Usage

1. **Start the server:**
   ```bash
   node server.js
   ```

2. **Access the application:**
   Open your web browser and navigate to `http://localhost:8080` (or the port specified in your `.env` file).

3. **Upload your shipment and vehicle data:**
   Use the provided form to upload your Excel files containing shipment and vehicle information.

4. **View optimized trips:**
   After processing, the application will generate an output Excel file and an HTML map displaying the optimized routes.

## Contributing
Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [Google Maps API](https://developers.google.com/maps/documentation)
- [xlsx](https://github.com/SheetJS/sheetjs)
- [Turf.js](https://turfjs.org/)
- [Leaflet.js](https://leafletjs.com/)