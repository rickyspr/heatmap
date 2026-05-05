import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Antag att denna fil innehåller en array: export const CITIES = [{ name: 'Stockholm', lat: 59.32, lon: 18.06, areaId: 3600052463 }, ...]
import { CITIES } from './data/cities_fetched';
import { SEARCH_KEYWORDS } from './data/search_keywords'; // Om du har en separat fil för sökord

// --- HJÄLPKOMPONENTER FÖR KARTAN ---

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
    if (!map || !points || points.length === 0) return;
    
    import('leaflet.heat').then(() => {
      map.eachLayer((layer) => {
        if (layer._heat) map.removeLayer(layer);
      });

      // --- LOGIK FÖR RELATIVITET ---
      // Om vi har massor av punkter (restauranger), behöver vi ett högre 'max' 
      // för att inte hela kartan ska bli röd direkt.
      // Om vi har få punkter (bibliotek), sänker vi 'max' så att även små 
      // kluster ser "heta" ut.
      
      const pointCount = points.length;
      let dynamicMax = 1.0;

      if (pointCount > 1000) {
        dynamicMax = 15; // Kräv mycket överlapp för rött (t.ex. Manhattan)
      } else if (pointCount > 500) {
        dynamicMax = 8;
      } else if (pointCount < 50) {
        dynamicMax = 0.5; // Gör gles data mycket tydligare
      } else {
        dynamicMax = 2.0;
      }

      L.heatLayer(points, {
        radius: 100,      // Något mindre radius gör det oftast lättare att se kluster
        blur: 15,   
        maxZoom: 17,
        max: dynamicMax, // Här sker magin!
        gradient: { 
          0.6: 'yellow',   // Inget syns under 40% av lokalt max (tar bort molnet)
          0.7: 'orange', 
          1.0: 'red' 
        }
      }).addTo(map);
    });
  }, [map, points]);

  return null;
}

// --- GENERISK DROPDOWN-KOMPONENT ---

function AutocompleteDropdown({ items, onSelect, displayKey, visible }) {
  if (!visible) return null;

  return (
    <ul style={{
      position: 'absolute', top: '100%', left: 0, width: '100%', maxHeight: '200px',
      overflowY: 'auto', backgroundColor: 'white', border: '1px solid #ccc',
      borderRadius: '4px', marginTop: '4px', padding: 0, margin: 0,
      listStyle: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 2000
    }}>
      {items.length > 0 ? (
        items.map((item, index) => (
          <li 
            key={index}
            onMouseDown={() => onSelect(item)} // Triggas före onBlur
            style={{
              padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #eee',
              fontSize: '14px', color: '#333', textAlign: 'left'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            {displayKey ? item[displayKey] : item}
          </li>
        ))
      ) : (
        <li style={{ padding: '10px 12px', color: '#999', fontSize: '13px' }}>Inga träffar...</li>
      )}
    </ul>
  );
}

// --- HUVUDAPPLIKATION ---

export default function App() {
  // Map/Data states
  const [barData, setBarData] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);

  // Vänster: Stad-sök
  const [cityInput, setCityInput] = useState(CITIES[0].name);
  const [filteredCities, setFilteredCities] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const cityRef = useRef(null);

  // Höger: Sökords-sök
  const [searchQuery, setSearchQuery] = useState(''); 
  const [filteredKeywords, setFilteredKeywords] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchRef = useRef(null);

  // Stäng dropdowns om man klickar utanför
  useEffect(() => {
    function handleClickOutside(event) {
      if (cityRef.current && !cityRef.current.contains(event.target)) {
        setShowCitySuggestions(false);
        setCityInput(selectedCity.name);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedCity]);

  // Logik för stads-input
  const handleCityChange = (e) => {
    const val = e.target.value;
    setCityInput(val);
    const filtered = CITIES.filter(c => c.name.toLowerCase().includes(val.toLowerCase()));
    setFilteredCities(filtered);
    setShowCitySuggestions(true);
  };

  // Logik för sökords-input
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    const filtered = SEARCH_KEYWORDS.filter(k => k.toLowerCase().includes(val.toLowerCase()));
    setFilteredKeywords(filtered);
    setShowSearchSuggestions(true);
  };

  const handleSearch = async () => {
    if (!searchQuery) return; 
    setIsSearching(true);
    setBarData([]);

    try {
      let currentAreaId = selectedCity.areaId;

      // Om areaId saknas, hämta via Nominatim
      if (!currentAreaId) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(selectedCity.name)}&format=json`);
        const data = await response.json();
        const relation = data.find(item => item.osm_type === 'relation');
        if (relation) {
          currentAreaId = 3600000000 + parseInt(relation.osm_id);
        } else {
          throw new Error("Kunde inte hitta administrativt område.");
        }
      }

      const response = await fetch('http://localhost:5001/api/run-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, areaId: currentAreaId }) 
      });

      const result = await response.json();
      if (result.status === "success") {
        setBarData(result.points);
      } else {
        alert("Fel: " + result.message);
      }
    } catch (error) {
      console.error(error);
      alert("Kunde inte hämta data.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      
      {/* KONTROLLPANEL VÄNSTER (STAD) */}
      <div ref={cityRef} style={panelStyle({ left: '60px' })}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>STAD</span>
        <div style={{ position: 'relative' }}>
          <input 
            type="text"
            value={cityInput}
            onChange={handleCityChange}
            onFocus={() => { setFilteredCities(CITIES); setShowCitySuggestions(true); }}
            placeholder="Välj stad..."
            style={inputStyle}
          />
          <AutocompleteDropdown 
            visible={showCitySuggestions}
            items={filteredCities.slice(0, 6)}
            displayKey="name"
            onSelect={(city) => {
              setSelectedCity(city);
              setCityInput(city.name);
              setShowCitySuggestions(false);
              setBarData([]); 
            }}
          />
        </div>
      </div>

      {/* KONTROLLPANEL HÖGER (SÖKORD) */}
      <div ref={searchRef} style={panelStyle({ right: '20px' })}>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            value={searchQuery}
            onChange={handleQueryChange}
            onFocus={() => { setFilteredKeywords(SEARCH_KEYWORDS); setShowSearchSuggestions(true); }}
            placeholder={`Sök i ${selectedCity.name}...`}
            style={inputStyle}
          />
          <AutocompleteDropdown 
            visible={showSearchSuggestions}
            items={filteredKeywords.slice(0, 5)}
            onSelect={(kw) => {
              setSearchQuery(kw);
              setShowSearchSuggestions(false);
            }}
          />
        </div>
        <button 
          onClick={handleSearch} 
          disabled={isSearching}
          style={buttonStyle(isSearching)}
        >
          {isSearching ? 'Söker...' : 'Sök'}
        </button>
      </div>

      {/* KARTKOMPONENT */}
      <MapContainer 
        center={[selectedCity.lat, selectedCity.lon]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
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

// --- STILAR ---

const panelStyle = (position) => ({
  position: 'absolute', 
  top: '20px', 
  zIndex: 1000,
  backgroundColor: 'white',
  padding: '12px',
  borderRadius: '10px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  ...position
});

const inputStyle = {
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #ddd',
  fontSize: '14px',
  width: '200px',
  outline: 'none',
  boxSizing: 'border-box'
};

const buttonStyle = (disabled) => ({
  padding: '10px 20px',
  cursor: disabled ? 'default' : 'pointer',
  borderRadius: '6px',
  backgroundColor: disabled ? '#aaa' : '#007bff',
  color: 'white',
  border: 'none',
  fontWeight: 'bold',
  transition: 'background 0.2s'
});