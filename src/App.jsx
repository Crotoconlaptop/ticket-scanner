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
   * Inicia la cámara trasera de ser posible, si falla, hace fallback a cualquier cámara.
   */
  const startCamera = async () => {
    try {
      // Preferimos la cámara trasera con facingMode: "environment"
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
      // Fallback: cualquier cámara
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (fallbackError) {
        console.error("No se pudo acceder a ninguna cámara:", fallbackError);
        alert("No se pudo acceder a ninguna cámara. Revisa los permisos y si estás en https.");
      }
    }
  };

  /**
   * Captura la foto actual del video y la convierte en DataURL para mostrarla y procesarla.
   */
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Ajustamos el canvas al tamaño del video.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujamos la imagen del video en el canvas.
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Obtenemos la imagen como DataURL (png).
    const imageData = canvas.toDataURL("image/png");
    setImage(imageData);
  };

  /**
   * Procesa la imagen con Tesseract para extraer CHK, tipo de tarjeta y el monto.
   * @param {string} chk - (Opcional) CHK específico con el que queremos asociar el ticket.
   */
  const processImage = async (chk = null) => {
    if (!image) return;

    try {
      // Convertimos la DataURL a blob para Tesseract
      const response = await fetch(image);
      const blob = await response.blob();

      // Reconocemos texto con Tesseract (idioma inglés).
      const {
        data: { text },
      } = await Tesseract.recognize(blob, "eng");

      // Extraemos el número de CHK
      const chkMatch = text.match(/CHK\s(\d+)/i);
      // Extraemos el monto (lo que sigue a SAR)
      const amountMatch = text.match(/SAR\s(\d+(\.\d+)?)/i);
      // Buscamos el tipo de tarjeta comparando con nuestra lista
      let cardTypeMatch = text.match(new RegExp(cardTypes.join("|"), "i"));

      const newTicket = {
        chk: chk || (chkMatch ? chkMatch[1] : "Desconocido"),
        cardType: cardTypeMatch ? cardTypeMatch[0].toUpperCase() : "DESCONOCIDO",
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
      };

      // Actualizamos el estado de tickets
      setTickets((prevTickets) => {
        // Ver si ya tenemos ese mismo CHK para sumar montos
        const existingIndex = prevTickets.findIndex(
          (t) => t.chk === newTicket.chk
        );

        if (existingIndex >= 0) {
          // Ya existe: sumamos montos y concatenamos tipos de tarjeta
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
          // No existe: agregamos un nuevo registro
          return [...prevTickets, newTicket];
        }
      });

      // Limpiamos la imagen de la vista previa
      setImage(null);
    } catch (error) {
      console.error("Error procesando la imagen:", error);
    }
  };

  /**
   * Genera un archivo Excel con los tickets actuales.
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
        {/* El video se muestra en todo el ancho posible, auto-height para ser responsivo */}
        <video
          ref={videoRef}
          className="w-full max-w-md rounded-md bg-black"
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

      {/* Botones para Excel y limpiar tabla */}
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

      {/* Canvas oculto para la captura de la imagen */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
