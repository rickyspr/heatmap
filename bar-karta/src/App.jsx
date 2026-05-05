import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- UPPDATERAD KOMPONENT MED ROBUST RENSNING ---
function HeatmapLayer({ points }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points) return;
    
    // 1. Importera leaflet.heat dynamiskt
    import('leaflet.heat').then(() => {
      
      // BRUTE FORCE RENSNING:
      // Eftersom den dynamiska importen är långsam kan gamla heatmap-lager 
      // "fastna" på kart-objektet utan att React vet om det.
      // Vi tvingar Leaflet att ta bort ALLA lager som ser ut som heatmaps.
      map.eachLayer((layer) => {
        // Vi identifierar heatmap-lager genom att leta efter en specifik 
        // intern property (_heat) som leaflet.heat lägger till.
        if (layer._heat) {
          map.removeLayer(layer);
        }
      });

      // 2. Om vi faktiskt har nya punkter, skapa ett nytt lager
      if (points.length > 0) {
        L.heatLayer(points, {
          radius: 40, 
          blur: 35,   
          maxZoom: 17,
          gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
        }).addTo(map);
      }
    });

    // Vi tar bort den gamla rensnings-useEffecten eftersom vi sköter det manuellt ovan.
  }, [map, points]); // Denna körs nu när punkterna ändras

  return null;
}

export default function App() {
  // Behöver inte längre bars.json eller heatmapKey, vi gör en renare setup
  const [barData, setBarData] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [isSearching, setIsSearching] = useState(false);

  // Laddar in den första datan
  useEffect(() => {
    fetch('/bars.json')
      .then(response => response.json())
      .then(data => {
        setBarData(data);
      })
      .catch(error => console.error("Kunde inte ladda bardata:", error));
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) return; 
    
    setIsSearching(true);
    // Vi rensar INTE data här, vi låter HeatmapLayer hantera det manuellt
    // genom att uppdatera barData med en tom lista först, för en snyggare övergång.
    setBarData([]); 

    try {
      const response = await fetch('http://localhost:5001/api/run-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }) 
      });

      const result = await response.json();
      
      if (result.status === "success") {
        console.log(`Laddade in ${result.points.length} nya punkter för "${searchQuery}".`);
        // Sätt de nya punkterna. HeatmapLayer kommer nu känna av ändringen och köra sin rensning.
        setBarData(result.points);
      } else {
        console.error("Ett fel uppstod på servern:", result.message);
      }

    } catch (error) {
      console.error("Fel vid kommunikation med Python:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      
      {/* --- SÖKMENYN OVERLAY --- */}
      <div style={{
        position: 'absolute', top: '20px', right: '20px', zIndex: 1000, 
        backgroundColor: 'white', padding: '10px', borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)', display: 'flex', gap: '10px'
      }}>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Sök (t.ex. cafe)"
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button 
          onClick={handleSearch} 
          disabled={isSearching}
          style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: '4px' }}
        >
          {isSearching ? 'Söker...' : 'Sök'}
        </button>
      </div>

      <MapContainer 
        center={[40.7128, -74.0060]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Alltid rendera HeatmapLayer, låt den hantera rensning/ritning internt via points */}
        <HeatmapLayer points={barData} />
        
      </MapContainer>
    </div>
  );
}