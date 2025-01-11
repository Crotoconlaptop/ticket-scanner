import React, { useState, useRef } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";

const cardTypes = ["VISA", "MASTERCARD", "mada", "AMEX", "DEBIT MASTERCARD", "DEBIT VISA", "GCC"];

const App = () => {
  const [tickets, setTickets] = useState([]);
  const [image, setImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }, // Rear camera
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing rear camera:", error);
      alert("Could not access the rear camera. Falling back to any available camera.");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (fallbackError) {
        console.error("Error accessing any camera:", fallbackError);
        alert("No camera access is available. Please check permissions.");
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
      setImage(imageData);
    }
  };

  const processImage = async () => {
    if (!image) return;

    const response = await fetch(image);
    const blob = await response.blob();

    try {
      const { data: { text } } = await Tesseract.recognize(blob, "eng");

      const chkMatch = text.match(/CHK\s(\d+)/);
      const amountMatch = text.match(/SAR\s(\d+(\.\d+)?)/);
      const cardTypeMatch = text.match(new RegExp(cardTypes.join("|"), "i"));

      const newTicket = {
        chk: chkMatch ? chkMatch[1] : "Unknown",
        cardType: cardTypeMatch ? cardTypeMatch[0].toUpperCase() : "Unknown",
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      };

      setTickets((prevTickets) => [...prevTickets, newTicket]);

      setImage(null); // Clear image after processing
    } catch (error) {
      console.error("Error processing the image:", error);
    }
  };

  const handleDownloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(tickets);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
    XLSX.writeFile(workbook, "tickets.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <h1 className="text-2xl font-bold text-center mb-5">Ticket Scanner</h1>

      {/* Camera Wrapper */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-full max-w-md aspect-w-16 aspect-h-9 bg-black rounded-md overflow-hidden">
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        </div>

        {/* Buttons */}
        <div className="flex space-x-4">
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

        {/* Captured Image */}
        {image && (
          <div className="mt-4">
            <img src={image} alt="Captured" className="border rounded-md mb-4 w-full max-w-md" />
            <button
              onClick={processImage}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Process Image
            </button>
          </div>
        )}

        {/* Tickets Table */}
        <table className="table-auto border-collapse border border-gray-300 w-full mt-4">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2">CHK</th>
              <th className="border border-gray-300 px-4 py-2">Card Type</th>
              <th className="border border-gray-300 px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, index) => (
              <tr key={index}>
                <td className="border border-gray-300 px-4 py-2">{ticket.chk}</td>
                <td className="border border-gray-300 px-4 py-2">{ticket.cardType}</td>
                <td className="border border-gray-300 px-4 py-2">{ticket.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Download Button */}
        <button
          onClick={handleDownloadExcel}
          className="bg-purple-500 text-white px-4 py-2 rounded mt-4"
        >
          Download Excel
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
