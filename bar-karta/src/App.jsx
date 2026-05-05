import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// list of cities with their coordinates
import { CITIES } from './data/cities_fetched';

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13);
  }, [center, map]);
  return null;
}

function HeatmapLayer({ points }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points) return;
    
    import('leaflet.heat').then(() => {
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
  
  // --- Nya state-variabler för Autocomplete ---
  const [cityInput, setCityInput] = useState(CITIES[0].name);
  const [filteredCities, setFilteredCities] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const autocompleteRef = useRef(null); // För att kunna stänga menyn när man klickar utanför

  // Stäng autocomplete-menyn om man klickar någon annanstans på sidan
  useEffect(() => {
    function handleClickOutside(event) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowSuggestions(false);
        // Återställ input-texten till den valda staden om användaren klickar bort
        setCityInput(selectedCity.name); 
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedCity]);

  const handleSearch = async () => {
    if (!searchQuery) return; 
    
    setIsSearching(true);
    setBarData([]);

    try {
      let currentAreaId = selectedCity.areaId;

      if (!currentAreaId) {
        console.log(`Hämtar areaId för ${selectedCity.name}...`);
        
        const baseUrl = "https://nominatim.openstreetmap.org/search";
        const params = "&format=json";
        let relation = null;

        // STEG 1: Försök söka efter platsen som en stad (city)
        let response = await fetch(`${baseUrl}?city=${encodeURIComponent(selectedCity.name)}${params}`);
        if (!response.ok) throw new Error("Kunde inte nå Nominatim API");
        let data = await response.json();
        relation = data.find(item => item.osm_type === 'relation');

        // STEG 2: Fallback för stadsstater/emirat (t.ex. Dubai) - sök som delstat (state)
        if (!relation) {
          console.warn(`Hittade ingen stads-relation för ${selectedCity.name}, letar efter delstat...`);
          let fallbackResponse = await fetch(`${baseUrl}?state=${encodeURIComponent(selectedCity.name)}${params}`);
          let fallbackData = await fallbackResponse.json();
          relation = fallbackData.find(item => item.osm_type === 'relation');
        }

        // STEG 3: Sista utvägen - gör en helt fri sökning (q)
        if (!relation) {
          console.warn(`Hittade ingen delstats-relation för ${selectedCity.name}, gör en fri sökning...`);
          let broadResponse = await fetch(`${baseUrl}?q=${encodeURIComponent(selectedCity.name)}${params}`);
          let broadData = await broadResponse.json();
          relation = broadData.find(item => item.osm_type === 'relation');
        }

        if (relation) {
          currentAreaId = 3600000000 + parseInt(relation.osm_id);
          setSelectedCity(prevCity => ({ ...prevCity, areaId: currentAreaId }));
        } else {
          throw new Error(`Kunde inte hitta en administrativ yta (OSM-relation) för ${selectedCity.name}.`);
        }
      }

      // Skicka till backend för Overpass-sökningen
      const response = await fetch('http://localhost:5001/api/run-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery,
          areaId: currentAreaId 
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
      alert(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // --- Funktioner för att hantera Autocomplete-logiken ---
  const handleCityInputChange = (e) => {
    const value = e.target.value;
    setCityInput(value);
    
    if (value.trim().length > 0) {
      const filtered = CITIES.filter(city => 
        city.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
    } else {
      setFilteredCities(CITIES);
    }
    setShowSuggestions(true);
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setCityInput(city.name);
    setShowSuggestions(false);
    setBarData([]); // Rensa heatmap
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      
      {/* VÄNSTER: AUTOCOMPLETE STADS-SÖK */}
      <div 
        ref={autocompleteRef}
        style={{ 
          position: 'absolute', 
          top: '20px', 
          left: '60px', 
          zIndex: 1000,
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <label style={{ fontWeight: 'bold', color: '#333' }}>Stad:</label>
        <div style={{ position: 'relative' }}>
          <input 
            type="text"
            value={cityInput}
            onChange={handleCityInputChange}
            onFocus={() => {
              setFilteredCities(CITIES);
              setShowSuggestions(true);
            }}
            placeholder="Sök efter stad..."
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px',
              width: '180px',
              outline: 'none'
            }}
          />
          
          {/* Autocomplete-dropdown */}
          {showSuggestions && (
            <ul style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              maxHeight: '250px',
              overflowY: 'auto',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginTop: '4px',
              padding: 0,
              margin: 0,
              listStyle: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              zIndex: 1001 // Måste vara över andra element
            }}>
              {filteredCities.length > 0 ? (
                filteredCities.slice(0, 6).map(city => (
                  <li 
                    key={city.name}
                    onMouseDown={() => handleCitySelect(city)} // onMouseDown triggas innan input-fältets onBlur
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    {city.name}
                  </li>
                ))
              ) : (
                <li style={{ padding: '8px 12px', color: '#888' }}>Ingen stad hittades</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* HÖGER: OSM SÖKFÄLT */}
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
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
        />
        <MapUpdater center={[selectedCity.lat, selectedCity.lon]} />
        <HeatmapLayer points={barData} />
      </MapContainer>
      
    </div>
  );
}