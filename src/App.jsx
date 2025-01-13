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
  const [processingForChk, setProcessingForChk] = useState(null);

  // Para el formulario manual
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualChk, setManualChk] = useState("");
  const [manualCardType, setManualCardType] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /**
   * Inicia la cámara (intenta la trasera, si falla hace fallback).
   */
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Error intentando acceder a la cámara trasera:", error);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (fallbackError) {
        console.error("No se pudo acceder a ninguna cámara:", fallbackError);
        alert("No se pudo acceder a la cámara. Verifica permisos y si estás en HTTPS.");
      }
    }
  };

  /**
   * Captura la imagen del video y la guarda como DataURL.
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
   * Procesa la imagen con Tesseract para extraer: CHK, tipo de tarjeta y monto.
   */
  const processImage = async (chk = null) => {
    if (!image) return;

    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const { data: { text } } = await Tesseract.recognize(blob, "eng");

      // Buscamos el número de CHK
      const chkMatch = text.match(/CHK\s(\d+)/i);
      // Buscamos el monto (después de SAR)
      const amountMatch = text.match(/SAR\s(\d+(\.\d+)?)/i);
      // Buscamos el tipo de tarjeta
      let cardTypeMatch = text.match(new RegExp(cardTypes.join("|"), "i"));

      const newTicket = {
        chk: chk || (chkMatch ? chkMatch[1] : "Desconocido"),
        cardType: cardTypeMatch ? cardTypeMatch[0].toUpperCase() : "DESCONOCIDO",
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      };

      mergeTicket(newTicket);
      setImage(null);
    } catch (error) {
      console.error("Error procesando la imagen:", error);
    }
  };

  /**
   * Agrega o fusiona un ticket en la tabla, sumando montos y concatenando tarjetas
   * si se repite el mismo CHK.
   */
  const mergeTicket = (newTicket) => {
    setTickets((prevTickets) => {
      const existingIndex = prevTickets.findIndex((t) => t.chk === newTicket.chk);
      if (existingIndex >= 0) {
        return prevTickets.map((t, i) =>
          i === existingIndex
            ? {
                ...t,
                amount: t.amount + newTicket.amount,
                cardType: `${t.cardType}, ${newTicket.cardType}`,
              }
            : t
        );
      } else {
        return [...prevTickets, newTicket];
      }
    });
  };

  /**
   * Maneja el envío de datos manuales.
   */
  const handleAddManualTicket = () => {
    if (!manualChk || !manualCardType || !manualAmount) {
      alert("Por favor, completa todos los campos antes de agregar.");
      return;
    }

    const newTicket = {
      chk: manualChk.trim(),
      cardType: manualCardType.toUpperCase(),
      amount: parseFloat(manualAmount),
    };

    mergeTicket(newTicket);

    // Limpiamos el formulario
    setManualChk("");
    setManualCardType("");
    setManualAmount("");
    setShowManualForm(false); // opcional: ocultar el formulario después de agregar
  };

  /**
   * Descarga los datos en un archivo Excel.
   */
  const handleDownloadExcel = () => {
    if (tickets.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(tickets);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
    XLSX.writeFile(workbook, "tickets.xlsx");
  };

  /**
   * Limpia la tabla de tickets.
   */
  const handleClearTickets = () => {
    setTickets([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Ticket Scanner</h1>

      {/* Sección de cámara */}
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
            Iniciar Cámara
          </button>
          <button
            onClick={captureImage}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Capturar Imagen
          </button>
        </div>
      </div>

      {/* Vista previa de la imagen capturada */}
      {image && (
        <div className="my-4 flex flex-col items-center">
          <img
            src={image}
            alt="Captured"
            className="border rounded-md w-full max-w-md mb-2"
          />
          <button
            onClick={() => processImage(processingForChk)}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            Procesar Imagen
          </button>
        </div>
      )}

      {/* Botón para mostrar/ocultar el formulario manual */}
      <div className="flex justify-center mt-4">
        <button
          onClick={() => setShowManualForm(!showManualForm)}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          {showManualForm ? "Ocultar Ingreso Manual" : "Agregar Datos Manualmente"}
        </button>
      </div>

      {/* Formulario para ingreso manual de datos */}
      {showManualForm && (
        <div className="max-w-md mx-auto bg-white shadow-md rounded px-4 py-4 mt-4">
          <h2 className="text-lg font-semibold mb-2">Ingresar Ticket Manualmente</h2>
          <div className="mb-2">
            <label className="block text-sm font-medium">CHK</label>
            <input
              type="text"
              value={manualChk}
              onChange={(e) => setManualChk(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mt-1"
              placeholder="Ej: 201897"
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium">Tipo de Tarjeta</label>
            <select
              value={manualCardType}
              onChange={(e) => setManualCardType(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mt-1"
            >
              <option value="">Selecciona el tipo de tarjeta</option>
              {cardTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium">Monto</label>
            <input
              type="number"
              step="0.01"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mt-1"
              placeholder="Ej: 125.00"
            />
          </div>

          <button
            onClick={handleAddManualTicket}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Agregar Manual
          </button>
        </div>
      )}

      {/* Tabla de resultados */}
      <table className="table-auto border-collapse border border-gray-300 w-full max-w-md mx-auto text-left mt-4">
        <thead>
          <tr>
            <th className="border border-gray-300 px-4 py-2">CHK</th>
            <th className="border border-gray-300 px-4 py-2">Tarjeta</th>
            <th className="border border-gray-300 px-4 py-2">Monto</th>
            <th className="border border-gray-300 px-4 py-2">Acciones</th>
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
                {/* Botón para añadir otro pago al mismo CHK (reiniciando la cámara) */}
                <button
                  onClick={() => {
                    setProcessingForChk(ticket.chk);
                    startCamera();
                  }}
                  className="bg-blue-600 text-white px-2 py-1 rounded"
                >
                  Agregar Pago
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Botones de exportar e limpiar tabla */}
      <div className="flex justify-center space-x-2 mt-4">
        <button
          onClick={handleDownloadExcel}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Descargar Excel
        </button>
        <button
          onClick={handleClearTickets}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Reiniciar Tabla
        </button>
      </div>

      {/* Canvas oculto para la captura */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
