import React, { useState, useRef } from "react";

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualData, setManualData] = useState({ chk: "", cardType: "", amount: "" });
  const [capturedImage, setCapturedImage] = useState(null);

  const startCamera = async () => {
    setErrorMessage(null); // Reset error message
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, // Attempt rear camera
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing the rear camera:", error);
      setErrorMessage("Unable to access the rear camera. Trying default camera...");
      // Attempt default camera
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
      setCapturedImage(imageData); // Save captured image for further processing
    }
  };

  const handleManualEntry = () => {
    setManualEntry(true); // Enable manual entry mode
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    console.log("Manual Data Submitted:", manualData);
    setManualEntry(false);
    setManualData({ chk: "", cardType: "", amount: "" }); // Reset manual data
  };

  const handleManualChange = (e) => {
    const { name, value } = e.target;
    setManualData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <h1 className="text-2xl font-bold text-center mb-5">Camera Test with Manual Validation</h1>

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
        <button
          onClick={handleManualEntry}
          className="bg-yellow-500 text-white px-4 py-2 rounded"
        >
          Manual Validation
        </button>
      </div>

      {capturedImage && (
        <div className="mt-4">
          <img src={capturedImage} alt="Captured" className="border rounded-md mb-4 w-full max-w-md" />
          <p className="text-center text-gray-600">Captured Image</p>
        </div>
      )}

      {manualEntry && (
        <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-gray-700">CHK:</label>
            <input
              type="text"
              name="chk"
              value={manualData.chk}
              onChange={handleManualChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700">Card Type:</label>
            <input
              type="text"
              name="cardType"
              value={manualData.cardType}
              onChange={handleManualChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700">Amount:</label>
            <input
              type="number"
              name="amount"
              value={manualData.amount}
              onChange={handleManualChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded mt-2"
          >
            Submit
          </button>
        </form>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
