import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function HeatmapLayer({ points }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || points.length === 0) return;
    
    import('leaflet.heat').then(() => {
      const heatLayer = L.heatLayer(points, {
        radius: 40, // Större radie för att punkterna ska smälta ihop mer
        blur: 35,   // Större blur för smidigare övergångar
        maxZoom: 17,
        gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
      }).addTo(map);

      return () => {
        map.removeLayer(heatLayer);
      };
    });
  }, [map, points]);

  return null;
}

export default function App() {
  // Här skapar vi ett "state" (tillstånd) för att hålla vår bardata
  const [barData, setBarData] = useState([]);

  useEffect(() => {
    // När sidan laddas, hämta filen vi skapade med Python
    fetch('/bars.json')
      .then(response => response.json())
      .then(data => {
        setBarData(data);
      })
      .catch(error => console.error("Kunde inte ladda bardata:", error));
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer 
        center={[59.3293, 18.0686]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {/* Visa bara heatmapen om vi faktiskt har hunnit ladda in datan */}
        {barData.length > 0 && <HeatmapLayer points={barData} />}
      </MapContainer>
    </div>
  );
}