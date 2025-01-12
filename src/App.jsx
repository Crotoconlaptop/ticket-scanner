import React, { useState, useRef } from "react";

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const startCamera = async () => {
    try {
      // Intentar acceder a la cámara trasera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing the rear camera:", error);
      setErrorMessage("Unable to access the rear camera. Trying default camera.");
      // Intentar acceder a cualquier cámara disponible
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (fallbackError) {
        console.error("Error accessing any camera:", fallbackError);
        setErrorMessage("Could not access any camera. Please check permissions and try again.");
      }
    }
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/png");
      console.log("Image captured:", imageData);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <h1 className="text-2xl font-bold text-center mb-5">Camera Test</h1>

      {errorMessage && (
        <p className="text-red-500 text-center mb-4">{errorMessage}</p>
      )}

      <div className="relative w-full max-w-md aspect-w-16 aspect-h-9 bg-black rounded-md overflow-hidden">
        <video
          ref={videoRef}
          className="absolute top-0 left-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
      </div>

      <div className="flex space-x-2 mt-4 justify-center">
        <button
          onClick={startCamera}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Start Camera
        </button>
        <button
          onClick={captureImage}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Capture Image
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
