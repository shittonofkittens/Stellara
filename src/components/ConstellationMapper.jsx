import React, { useState, useRef } from 'react';
import './ConstellationMapper.css';

const constellationList = [
  "andromeda.jpeg", "aquarius.jpeg", "aries.jpeg", "auriga.jpeg",
  "camelopardalis.jpeg", "canes-venatici.jpeg", "capricornus.jpeg",
  "carina.jpeg", "cassiopeia.jpeg", "centaurus.jpeg", "cepheus.jpeg",
  "cetus.jpeg", "chamaeleon.jpeg", "columba.jpeg", "corvus.jpeg",
  "crux.jpeg", "cygnus.jpeg", "delphinus.jpeg", "draco.jpeg",
  "fornax.jpeg", "grus.jpeg", "hercules.jpeg", "horologium.jpeg",
  "hydra.jpeg", "indus.jpeg", "lacerta.jpeg", "leo.jpeg",
  "libra.jpeg", "lupus.jpeg", "lyra.jpeg", "monoceros.jpeg",
  "orion.jpeg", "pegasus.jpeg", "perseus.jpeg", "phoenix.jpeg",
  "pisces.jpeg", "puppis.jpeg", "sagittarius.jpeg", "scorpius.jpeg",
  "sculptor.jpeg", "serpens.jpeg", "taurus.jpeg", "triangulum.jpeg",
  "tucana.jpeg", "virgo.jpeg", "volans.jpeg", "vulpecula.jpeg",
  "dorado.jpeg"
];

export default function ConstellationMapper() {
  const [index, setIndex] = useState(0);
  const [points, setPoints] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedStar, setSelectedStar] = useState(null);

  const imageRef = useRef(null);

  const currentImage = constellationList[index];
  const imageName = currentImage.replace('.jpeg', '');

  /* =========================
     CLICK TO ADD STAR
     ========================= */
  const handleImageClick = (e) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newIndex = points.length;
    setPoints(prev => [...prev, { x, y }]);

    if (selectedStar !== null) {
      setLines(prev => [...prev, [selectedStar, newIndex]]);
      setSelectedStar(null);
    } else {
      setSelectedStar(newIndex);
    }
  };

  /* =========================
     STAR CLICK (CONNECT MODE)
     ========================= */
  const handleStarClick = (e, starIndex) => {
    e.stopPropagation();

    if (selectedStar !== null && selectedStar !== starIndex) {
      setLines(prev => [...prev, [selectedStar, starIndex]]);
      setSelectedStar(null);
    } else {
      setSelectedStar(starIndex);
    }
  };

  /* =========================
     UNDO LAST STAR (SAFE)
     ========================= */
  const undoLast = () => {
    setPoints(prev => {
      const newPoints = prev.slice(0, -1);

      setLines(lines =>
        lines.filter(([a, b]) => a < newPoints.length && b < newPoints.length)
      );

      setSelectedStar(null);
      return newPoints;
    });
  };

  /* =========================
     NEXT CONSTELLATION
     ========================= */
  const nextConstellation = () => {
    setIndex(i => (i + 1) % constellationList.length);
    setPoints([]);
    setLines([]);
    setSelectedStar(null);
  };

  /* =========================
     EXPORT JSON
     ========================= */
  const handleExport = () => {
    const data = { stars: points, lines };
    const json = JSON.stringify(data, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${imageName}_coords.json`;
    link.click();
  };

  return (
    <div className="mapper-container">
      <h1>NYRStars Mapper</h1>
      <h2>{imageName}</h2>

      <div className="button-row">
        <button onClick={nextConstellation}>Next Constellation</button>
        <button onClick={undoLast}>Undo Last Star</button>
        <button onClick={handleExport}>Export JSON</button>
      </div>

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={`/constellations/${currentImage}`}
          alt={imageName}
          ref={imageRef}
          onClick={handleImageClick}
          className="constellation-image"
        />

        {/* LINES */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: imageRef.current?.offsetWidth || 0,
            height: imageRef.current?.offsetHeight || 0,
            pointerEvents: 'none',
          }}
        >
          <svg
            width={imageRef.current?.offsetWidth || 0}
            height={imageRef.current?.offsetHeight || 0}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {lines.map(([start, end], idx) => {
              const startCoord = points[start];
              const endCoord = points[end];
              if (!startCoord || !endCoord) return null;

              const x1 = startCoord.x * (imageRef.current?.offsetWidth || 0);
              const y1 = startCoord.y * (imageRef.current?.offsetHeight || 0);
              const x2 = endCoord.x * (imageRef.current?.offsetWidth || 0);
              const y2 = endCoord.y * (imageRef.current?.offsetHeight || 0);

              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>

        {/* STARS */}
        {points.map((coord, index) => (
          <div
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedStar !== null && selectedStar !== index) {
                // Add the new line only if it doesn't already exist
                const newLine = [selectedStar, index].sort((a, b) => a - b);
                const lineExists = lines.some(
                  (line) => line[0] === newLine[0] && line[1] === newLine[1]
                );
                if (!lineExists) {
                  setLines((prevLines) => [...prevLines, newLine]);
                }
                  setSelectedStar(null);
              } else {
                setSelectedStar(index);
              }
            }}
            style={{
              position: 'absolute',
              top: `${coord.y * (imageRef.current?.offsetHeight || 0)}px`,
              left: `${coord.x * (imageRef.current?.offsetWidth || 0)}px`,
              width: selectedStar === index ? '10px' : '6px',
              height: selectedStar === index ? '10px' : '6px',
              backgroundColor: selectedStar === index ? 'yellow' : 'red',
              borderRadius: '50%',
              border: selectedStar === index ? '2px solid gold' : 'none',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <div className="coords-list">
        <h3>Stars</h3>
        <ul>
          {points.map((p, i) => (
            <li key={i}>
              ⭐ {i + 1}: ({p.x.toFixed(4)}, {p.y.toFixed(4)})
            </li>
          ))}
        </ul>

        <h3>Lines</h3>
        <ul>
          {lines.map(([a, b], i) => (
            <li key={i}>🔗 {a + 1} → {b + 1}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
