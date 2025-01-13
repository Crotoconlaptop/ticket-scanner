import React, { useState, useRef } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";

const cardTypes = [
  "VISA",
  "MASTERCARD",
  "mada",
  "AMEX",
  "DEBIT MASTERCARD",
  "DEBIT VISA",
  "GCC",
];

const App = () => {
  const [tickets, setTickets] = useState([]);
  const [image, setImage] = useState(null);

  // Para saber si se está editando una fila (y cuál es):
  const [editingIndex, setEditingIndex] = useState(null);

  // Para mostrar/ocultar el formulario manual (modal).
  const [showManualForm, setShowManualForm] = useState(false);

  // Datos del formulario manual.
  const [manualChk, setManualChk] = useState("");
  const [manualCardType, setManualCardType] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /**
   * Inicia la cámara (preferiblemente trasera, fallback si no existe).
   */
  const startCamera = async () => {
    try {
      const constraints = {
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Error trying to access rear camera:", error);
      // Fallback: any camera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (fallbackError) {
        console.error("No camera available:", fallbackError);
        alert(
          "Cannot access the camera. Check permissions and if you're on HTTPS."
        );
      }
    }
  };

  /**
   * Captura la foto del video y la convierte a DataURL.
   */
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");
    setImage(imageData);
  };

  /**
   * Procesa la imagen con Tesseract para extraer CHK, cardType y amount.
   */
  const processImage = async () => {
    if (!image) return;

    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const {
        data: { text },
      } = await Tesseract.recognize(blob, "eng");

      // Extraemos el CHK
      const chkMatch = text.match(/CHK\s(\d+)/i);
      // Extraemos el monto (seguido de SAR)
      const amountMatch = text.match(/SAR\s(\d+(\.\d+)?)/i);
      // Tipo de tarjeta si coincide con la lista
      const cardTypeMatch = text.match(new RegExp(cardTypes.join("|"), "i"));

      const newTicket = {
        chk: chkMatch ? chkMatch[1] : "UNKNOWN",
        cardType: cardTypeMatch ? cardTypeMatch[0].toUpperCase() : "UNKNOWN",
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      };

      mergeTicketBySum(newTicket);
      setImage(null);
    } catch (error) {
      console.error("Error processing image:", error);
    }
  };

  /**
   * Funde el ticket al arreglo: 
   * - Si el CHK ya existe, SUMA su monto y CONCATENA el cardType.
   * - Si no existe, crea uno nuevo.
   * (Este comportamiento lo mantenemos para el OCR).
   */
  const mergeTicketBySum = (newTicket) => {
    setTickets((prev) => {
      const index = prev.findIndex((t) => t.chk === newTicket.chk);
      if (index >= 0) {
        return prev.map((t, i) =>
          i === index
            ? {
                ...t,
                amount: t.amount + newTicket.amount,
                cardType: `${t.cardType}, ${newTicket.cardType}`,
              }
            : t
        );
      } else {
        return [...prev, newTicket];
      }
    });
  };

  /**
   * Cuando abrimos el formulario manual desde una fila, precargamos su data.
   */
  const handleOpenManualForm = (ticket, index) => {
    setEditingIndex(index);
    setManualChk(ticket.chk);
    setManualCardType(ticket.cardType);
    setManualAmount(ticket.amount);
    setShowManualForm(true);
  };

  /**
   * "Guarda" los datos ingresados manualmente:
   * - Reemplaza directamente la fila existente (no crea una nueva, ni suma montos).
   */
  const handleSaveManualTicket = () => {
    if (!manualChk || !manualCardType || !manualAmount) {
      alert("Please fill out all fields.");
      return;
    }

    const updatedTicket = {
      chk: manualChk.trim(),
      cardType: manualCardType.toUpperCase(),
      amount: parseFloat(manualAmount),
    };

    setTickets((prev) => {
      const newTickets = [...prev];
      // Reemplazamos la fila en la que estamos editando:
      newTickets[editingIndex] = updatedTicket;
      return newTickets;
    });

    // Limpiamos el formulario
    setEditingIndex(null);
    setManualChk("");
    setManualCardType("");
    setManualAmount("");
    setShowManualForm(false);
  };

  /**
   * Descarga en un archivo Excel los datos de 'tickets'.
   */
  const handleDownloadExcel = () => {
    if (tickets.length === 0) {
      alert("No data to export.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(tickets);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
    XLSX.writeFile(workbook, "tickets.xlsx");
  };

  /**
   * Limpia toda la tabla.
   */
  const handleClearTickets = () => {
    setTickets([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Ticket Scanner</h1>

      {/* Camera section */}
      <div className="flex flex-col items-center w-full space-y-2">
        <video
          ref={videoRef}
          className="w-full max-w-md bg-black rounded-md"
          style={{ maxHeight: "80vh" }}
          autoPlay
          muted
          playsInline
        />

        <div className="flex space-x-2">
          <button
            onClick={startCamera}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Start Camera
          </button>
          <button
            onClick={captureImage}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Capture Image
          </button>
        </div>
      </div>

      {/* Preview of captured image */}
      {image && (
        <div className="my-4 flex flex-col items-center">
          <img
            src={image}
            alt="Captured"
            className="border rounded-md w-full max-w-md mb-2"
          />
          <button
            onClick={processImage}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            Process Image
          </button>
        </div>
      )}

      {/* Tickets table */}
      <table className="table-auto border-collapse border border-gray-300 w-full max-w-md mx-auto text-left mt-4">
        <thead>
          <tr>
            <th className="border border-gray-300 px-4 py-2">CHK</th>
            <th className="border border-gray-300 px-4 py-2">Card Type</th>
            <th className="border border-gray-300 px-4 py-2">Amount</th>
            <th className="border border-gray-300 px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket, index) => (
            <tr key={index}>
              <td className="border border-gray-300 px-4 py-2">{ticket.chk}</td>
              <td className="border border-gray-300 px-4 py-2">
                {ticket.cardType}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {ticket.amount.toFixed(2)}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                <button
                  onClick={() => handleOpenManualForm(ticket, index)}
                  className="bg-gray-600 text-white px-2 py-1 rounded"
                >
                  Add Manually
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Download / Clear buttons */}
      <div className="flex justify-center space-x-2 mt-4">
        <button
          onClick={handleDownloadExcel}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Download Excel
        </button>
        <button
          onClick={handleClearTickets}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Reset Table
        </button>
      </div>

      {/* Modal for manual data entry */}
      {showManualForm && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
          onClick={() => {
            // Cerrar el modal al hacer click en el fondo si quieres:
            // setShowManualForm(false);
          }}
        >
          {/* Contenedor interno para el formulario */}
          <div
            className="bg-white p-4 rounded shadow-md w-full max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()} // Evita que el click al formulario cierre el modal
          >
            <h2 className="text-lg font-semibold mb-2">Manual Ticket Data</h2>

            <div className="mb-3">
              <label className="block text-sm font-medium">CHK</label>
              <input
                type="text"
                value={manualChk}
                onChange={(e) => setManualChk(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 mt-1"
                placeholder="e.g. 201897"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium">Card Type</label>
              <select
                value={manualCardType}
                onChange={(e) => setManualCardType(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 mt-1"
              >
                <option value="">Select card type</option>
                {cardTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium">Amount</label>
              <input
                type="number"
                step="0.01"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 mt-1"
                placeholder="e.g. 125.00"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleSaveManualTicket}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowManualForm(false);
                  setEditingIndex(null);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
