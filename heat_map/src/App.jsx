import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Assume this file contains an array: export const CITIES = [{ name: 'Stockholm', lat: 59.32, lon: 18.06, areaId: 3600052463 }, ...]
import { CITIES } from './data/cities_fetched';
import { SEARCH_KEYWORDS } from './data/search_keywords'; // If you have a separate file for search keywords


// --- HELPER COMPONENTS FOR THE MAP ---

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 0.25 // makes the movement smooth and nice
    });
  }, [center, zoom, map]);
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

      // --- LOGIC FOR RELATIVITY ---
      // If we have lots of points (restaurants), we need a higher 'max' 
      // so the entire map doesn't turn red immediately.
      // If we have few points (libraries), we lower 'max' so that even small 
      // clusters look "hot".
      
      const pointCount = points.length;
      let dynamicMax = 1.0;

      if (pointCount > 1000) {
        dynamicMax = 15; // Require much overlap for red (e.g. Manhattan)
      } else if (pointCount > 100) {
        dynamicMax = 8; // Some overlap is needed (i.e Gothenburg)
      } else {
        dynamicMax = 2.0;
      }

      L.heatLayer(points, {
        radius: 100,      // Big radius to indicate bigger areas rather than individual points
        blur: 15,   
        maxZoom: 17,
        max: dynamicMax, // max is different based on how many points we have, to keep the heatmap informative
        gradient: { // The color gradient for the heatmap, from blue (cool) to red (hot)
          0.0: 'blue', 
          0.2: 'cyan', 
          0.4: 'lime',
          0.6: 'yellow',
          0.7: 'orange', 
          1.0: 'red' 
        }
      }).addTo(map);
    });
  }, [map, points]);

  return null;
}

// --- GENERIC DROPDOWN COMPONENT ---

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
            onMouseDown={() => onSelect(item)} // Triggered before onBlur
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
        <li style={{ padding: '10px 12px', color: '#999', fontSize: '13px' }}>No matches...</li>
      )}
    </ul>
  );
}

// --- MAIN APPLICATION ---

export default function App() {
  // Map/Data states
  const [barData, setBarData] = useState([]);
  const [clusters, setClusters] = useState([]); // For clusters 
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  // To control map view (center and zoom) based on clusters
  const [viewCenter, setViewCenter] = useState([selectedCity.lat, selectedCity.lon]);
  const [zoomLevel, setZoomLevel] = useState(13); // Vi kan även kontrollera zoom

  // Left: City search
  const [cityInput, setCityInput] = useState(CITIES[0].name);
  const [filteredCities, setFilteredCities] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const cityRef = useRef(null);

  // Right: Search keywords
  const [searchQuery, setSearchQuery] = useState(''); 
  const [filteredKeywords, setFilteredKeywords] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchRef = useRef(null);

  

  // Close dropdowns when clicking outside
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

  // Logic for city input
  const handleCityChange = (e) => {
    const val = e.target.value;
    setCityInput(val);
    const filtered = CITIES.filter(c => c.name.toLowerCase().includes(val.toLowerCase()));
    setFilteredCities(filtered);
    setShowCitySuggestions(true);
  };

  // Logic for search keywords input
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

      // If areaId is missing, fetch via Nominatim
      if (!currentAreaId) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(selectedCity.name)}&format=json`);
        const data = await response.json();
        const relation = data.find(item => item.osm_type === 'relation');
        if (relation) {
          currentAreaId = 3600000000 + parseInt(relation.osm_id);
        } else {
          throw new Error("Could not find administrative area.");
        }
      }

      const response = await fetch('https://heatmap-cogt.onrender.com/api/run-script', { // For testing: 'http://localhost:5000/api/run-script' for comercial https://heatmap-cogt.onrender.com/api/run-script
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, areaId: currentAreaId }) 
      });

      const result = await response.json();
      if (result.status === "success") {
        setBarData(result.points);
        setClusters(result.clusters || []); // Saves clusters
      } else {
        alert("Error: " + result.message);
      }
    } catch (error) {
      console.error(error);
      alert("Could not fetch data.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      
      {/* CONTROL PANEL LEFT (CITY) */}
      <div ref={cityRef} style={panelStyle({ left: '60px' })}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>CITY</span>
        <div style={{ position: 'relative' }}>
          <input 
            type="text"
            value={cityInput}
            onChange={handleCityChange}
            onFocus={() => { setFilteredCities(CITIES); setShowCitySuggestions(true); }}
            placeholder="Select city..."
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
              
              // --- FIX: Uppdatera kartans position till den nya staden ---
              setViewCenter([city.lat, city.lon]);
              setZoomLevel(13); 
              
              // Rensa gammal data så det blir tydligt att vi bytt stad
              setBarData([]); 
              setClusters([]); 
            }}
          />
        </div>
      </div>

      {/* CONTROL PANEL RIGHT (SEARCH KEYWORDS) */}
      <div ref={searchRef} style={panelStyle({ right: '20px' })}>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            value={searchQuery}
            onChange={handleQueryChange}
            onFocus={() => { setFilteredKeywords(SEARCH_KEYWORDS); setShowSearchSuggestions(true); }}
            placeholder={`Search in ${selectedCity.name}...`}
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
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* MAP COMPONENT */}
      {/* MAP COMPONENT */}
      <MapContainer 
        center={viewCenter} 
        zoom={zoomLevel} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
        />
        
        {/* Uppdaterad MapUpdater så den faktiskt lyssnar på dina klick! */}
        <MapUpdater center={viewCenter} zoom={zoomLevel} />
        
        <HeatmapLayer points={barData} />

        {/* FLYTTAD: Markörerna MÅSTE ligga inuti MapContainer! */}
        {clusters.map((cluster) => (
          <Marker position={cluster.center} key={cluster.id}>
            <Popup>
              <strong>{cluster.name}</strong><br />
              {cluster.count} ställen hittade här.
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* NY PANEL FÖR RESULTAT/BARGATOR (Denna ska ligga utanför kartan) */}
      {clusters.length > 0 && (
        <div style={panelStyle({ bottom: '20px', left: '20px', flexDirection: 'column', alignItems: 'flex-start', maxHeight: '400px', overflowY: 'auto' })}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Heta Områden</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
            {clusters.map((cluster) => (
              <li key={cluster.id} 
                  style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    setViewCenter(cluster.center); // Flytta kartan!
                    setZoomLevel(16);             // Zooma in på gatan
                  }}
              >
                <strong>{cluster.name}</strong>
                <div style={{ fontSize: '12px', color: '#666' }}>{cluster.count} träffar</div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

// --- STYLES ---

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