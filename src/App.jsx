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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /**
   * Inicia la cámara intentando usar primero la cámara trasera (environment).
   * Si no está disponible o falla, hace fallback a cualquier cámara disponible.
   */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }, // Intenta la cámara trasera
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error(
        "Error intentando acceder a la cámara trasera. Intentando la cámara por defecto."
      );
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (fallbackError) {
        console.error("Error al acceder a cualquier cámara:", fallbackError);
        alert("No se pudo acceder a ninguna cámara. Revisa los permisos.");
      }
    }
  };

  /**
   * Toma una foto de la vista de la cámara y la guarda como DataURL en el estado.
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
   * Procesa la imagen usando Tesseract para extraer la información relevante (CHK, Card y monto).
   * @param {string} chk - Opcionalmente, forzar a que el CHK sea uno específico
   *                       (para el caso en que estemos añadiendo más pagos al mismo CHK).
   */
  const processImage = async (chk = null) => {
    if (!image) return;

    try {
      // Convertimos la dataURL en blob para enviarla a Tesseract
      const response = await fetch(image);
      const blob = await response.blob();

      // Realizamos OCR con Tesseract
      const {
        data: { text },
      } = await Tesseract.recognize(blob, "eng");

      // Usamos expresiones regulares para encontrar los patrones
      const chkMatch = text.match(/CHK\s(\d+)/i);
      const amountMatch = text.match(/SAR\s(\d+(\.\d+)?)/i);

      // Para el tipo de tarjeta, buscamos si hay coincidencia en cualquiera de las definidas en cardTypes
      let cardTypeMatch = text.match(new RegExp(cardTypes.join("|"), "i"));

      // Creamos el nuevo ticket
      const newTicket = {
        chk: chk || (chkMatch ? chkMatch[1] : "Desconocido"),
        cardType: cardTypeMatch ? cardTypeMatch[0].toUpperCase() : "DESCONOCIDO",
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      };

      // Actualizamos el estado de tickets
      setTickets((prevTickets) => {
        // Verificamos si ya existe un ticket con el mismo CHK
        const existingIndex = prevTickets.findIndex(
          (t) => t.chk === newTicket.chk
        );

        if (existingIndex >= 0) {
          // Ya existe, sumamos montos y concatenamos tipos de tarjeta
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
          // No existe, agregamos uno nuevo
          return [...prevTickets, newTicket];
        }
      });

      // Limpiamos la imagen mostrada tras procesarla
      setImage(null);
    } catch (error) {
      console.error("Error procesando la imagen:", error);
    }
  };

  /**
   * Descarga la tabla de tickets en un archivo Excel.
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
   * Reinicia la tabla de tickets.
   */
  const handleClearTickets = () => {
    setTickets([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <h1 className="text-2xl font-bold text-center mb-5">Ticket Scanner</h1>

      <div className="flex flex-col items-center space-y-4">
        {/* Sección de la cámara */}
        <div className="camera-wrapper relative w-full max-w-md aspect-w-16 aspect-h-9 bg-black rounded-md overflow-hidden">
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        </div>

        {/* Botones para iniciar cámara y capturar imagen */}
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

        {/* Vista previa de la imagen capturada y botón de procesar */}
        {image && (
          <div className="image-preview mt-4 flex flex-col items-center">
            <img
              src={image}
              alt="Captured"
              className="border rounded-md mb-4 w-full max-w-md"
            />
            <button
              onClick={() => processImage(processingForChk)}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Procesar Imagen
            </button>
          </div>
        )}

        {/* Tabla de resultados */}
        <table className="table-auto border-collapse border border-gray-300 w-full text-left mt-4">
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
                  {/* Botón para añadir otro pago al mismo CHK */}
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

        {/* Botones de exportación y limpieza de tabla */}
        <div className="flex space-x-2 mt-4">
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
      </div>

      {/* Canvas oculto para render de la imagen antes de convertirla en DataURL */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
