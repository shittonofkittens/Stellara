import React, { useEffect, useRef, useState } from 'react';

const segmentGroups = [
  [0, 1, 2, 3],
  [0, 3, 4, 5],
  [0, 5, 6, 7],
  [0, 7, 8, 9],
  [0, 9, 10, 1]
];

const StarFiller = () => {
  const canvasRef = useRef(null);
  const [starPoints, setStarPoints] = useState([]);
  const [fills, setFills] = useState([]); // { segmentIndex: 0-4, color: 'gold' | 'silver' }
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // Load star points from file
    fetch('/data/star-points.json')
      .then(res => res.json())
      .then(setStarPoints);

    // Load star image
    const img = new Image();
    img.src = '/star.png';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || starPoints.length !== 11) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas to match image size
    canvas.width = imgRef.current.width;
    canvas.height = imgRef.current.height;

    // Clear and draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0);

    // Fill segments
    fills.forEach(({ segmentIndex, color }) => {
      const group = segmentGroups[segmentIndex];
      if (group.every(index => starPoints[index])) {
        ctx.beginPath();
        ctx.moveTo(starPoints[group[0]].x, starPoints[group[0]].y);
        for (let i = 1; i < group.length; i++) {
          const pt = starPoints[group[i]];
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    });
  }, [fills, imgLoaded, starPoints]);

  const handleFill = (color) => {
    if (fills.length >= 5) return; // Max 5 segments
    setFills([...fills, { segmentIndex: fills.length, color }]);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <canvas ref={canvasRef} style={{ border: '1px solid #ccc', maxWidth: '100%' }} />
      <div style={{ marginTop: '10px' }}>
        <button onClick={() => handleFill('gold')} disabled={fills.length >= 5}>Gold</button>
        <button onClick={() => handleFill('silver')} disabled={fills.length >= 5} style={{ marginLeft: '10px' }}>Silver</button>
      </div>
    </div>
  );
};

export default StarFiller;
