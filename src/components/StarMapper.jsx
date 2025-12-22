import React, { useRef, useState, useEffect } from 'react';

const StarMapper = () => {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [img, setImg] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [centerPoint, setCenterPoint] = useState(null);

  useEffect(() => {
    const image = new Image();
    image.src = '/star.png';

    image.onload = () => {
      console.log('✅ Image loaded with size:', image.width, image.height);
      setImageSize({ width: image.width, height: image.height });
      setCenterPoint({ x: image.width / 2, y: image.height / 2 });
      setImg(image);
    };

    image.onerror = (err) => {
      console.error('❌ Failed to load image: /star.png');
    };
  }, []);

  useEffect(() => {
    if (!img || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Explicitly set canvas dimensions to match image
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    canvas.style.width = `${imageSize.width}px`;
    canvas.style.height = `${imageSize.height}px`;

    // Clear + draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Draw center red dot
    if (centerPoint) {
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(centerPoint.x, centerPoint.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw clicked points
    ctx.fillStyle = 'blue';
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    points.forEach((pt, idx) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(idx + 1, pt.x + 6, pt.y - 6);
    });
  }, [img, points, centerPoint]);

  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setPoints((prev) => [...prev, { x, y }]);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem',
        backgroundColor: '#111',
        minHeight: '100vh',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          border: '2px solid #555',
          backgroundColor: '#000',
          cursor: 'crosshair',
        }}
      />
      <div
        style={{
          marginTop: '1rem',
          color: '#eee',
          width: '100%',
          maxWidth: '800px',
          fontFamily: 'monospace',
          backgroundColor: '#222',
          padding: '1rem',
          borderRadius: '8px',
          overflowX: 'auto',
        }}
      >
        <strong style={{ color: '#ccc' }}>Plotted Points:</strong>
        <pre>{JSON.stringify(points, null, 2)}</pre>
      </div>
    </div>
  );
};

export default StarMapper;
