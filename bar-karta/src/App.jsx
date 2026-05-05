import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// list of cities with their coordinates and OSM area IDs, imported from a separate file for better organization
import { CITIES } from './data/cities';


// Hjälpkomponent för att flytta kartan när man byter stad
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13); // Animerar kameran till den nya staden
  }, [center, map]);
  return null;
}

function HeatmapLayer({ points }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points) return;
    
    import('leaflet.heat').then(() => {
      // Ta bort gamla heatmap-lager först
      map.eachLayer((layer) => {
        if (layer._heat) {
          map.removeLayer(layer);
        }
      });

      if (points.length > 0) {
        L.heatLayer(points, {
          radius: 40, 
          blur: 35,   
          maxZoom: 17,
          gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
        }).addTo(map);
      }
    });
  }, [map, points]);

  return null;
}

export default function App() {
  const [barData, setBarData] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);

  const handleSearch = async () => {
    if (!searchQuery) return; 
    
    setIsSearching(true);
    setBarData([]);

    try {
      const response = await fetch('http://localhost:5001/api/run-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: searchQuery,
          areaId: selectedCity.areaId 
        }) 
      });

      const result = await response.json();
      
      if (result.status === "success") {
        setBarData(result.points);
      } else {
        alert("Ett fel uppstod: " + result.message);
      }

    } catch (error) {
      console.error("Fel vid kommunikation:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCityChange = (event) => {
    const cityName = event.target.value;
    const newCity = CITIES.find(city => city.name === cityName);
    if (newCity) {
      setSelectedCity(newCity);
    }
  };

  return (
    // Nu använder vi position: relative så att kartan täcker allt och gränssnittet svävar ovanpå
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      
      {/* VÄNSTER: FLYTANDE STADSMENY */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '60px', // Flyttad lite till höger så den inte döljer zoom-knapparna
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <label style={{ fontWeight: 'bold', color: '#333' }}>Stad:</label>
        <select 
          value={selectedCity.name} 
          onChange={handleCityChange}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px',
            cursor: 'pointer',
            outline: 'none',
            backgroundColor: 'white',
            color: '#333'
          }}
        >
          {CITIES.map(city => (
            <option key={city.name} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      {/* HÖGER: SÖKFÄLT (Oförändrad layout, men svävar över kartan) */}
      <div style={{
        position: 'absolute', top: '20px', right: '20px', zIndex: 1000, 
        backgroundColor: 'white', padding: '10px', borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)', display: 'flex', gap: '10px'
      }}>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Sök i ${selectedCity.name}...`}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button 
          onClick={handleSearch} 
          disabled={isSearching}
          style={{ 
            padding: '8px 16px', cursor: 'pointer', borderRadius: '4px',
            backgroundColor: isSearching ? '#ccc' : '#4CAF50',
            color: 'white', border: 'none'
          }}
        >
          {isSearching ? 'Söker...' : 'Sök'}
        </button>
      </div>

      {/* KARTAN */}
      <MapContainer 
        center={[selectedCity.lat, selectedCity.lon]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapUpdater center={[selectedCity.lat, selectedCity.lon]} />
        <HeatmapLayer points={barData} />
      </MapContainer>
      
    </div>
  );
}