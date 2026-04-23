const { sendError } = require("./response.helper");

/**
 * Simpler nativer Multipart-Parser fuer Node.js HTTP (nimmt das erste Bild an)
 */
function parseMultipartImage(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return reject(new Error('Content-Type muss multipart/form-data sein'));
    }

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) return reject(new Error('Kein Boundary gefunden'));
    
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const boundaryBuffer = Buffer.from('--' + boundary);

    const bodyParts = [];
    req.on('data', chunk => bodyParts.push(chunk));

    req.on('end', () => {
      const buffer = Buffer.concat(bodyParts);
      
      // Sehr simples Boundary Splitting (nur fuer unser POC)
      let fileBuffer = null;
      let mimeType = null;

      // Suche nach Datei-Signaturen und extrahiere
      // In einem Produktion-System sollte busboy genutzt werden.
      // Hier extrahieren wir manuell:
      const fileIndex = buffer.indexOf(Buffer.from('filename="'));
      if (fileIndex !== -1) {
        const typeIndex = buffer.indexOf(Buffer.from('Content-Type: '), fileIndex);
        if (typeIndex !== -1) {
          const typeEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), typeIndex);
          if (typeEnd !== -1) {
            mimeType = buffer.subarray(typeIndex + 14, typeEnd).toString('utf8').trim();
            
            const startData = typeEnd + 4;
            const endData = buffer.indexOf(boundaryBuffer, startData) - 2; // - \r\n
            
            if (endData > startData) {
              fileBuffer = buffer.subarray(startData, endData);
            }
          }
        }
      }

      if (!fileBuffer || !mimeType) {
        return reject(new Error('Keine Datei oder Mime-Type gefunden'));
      }

      // 5MB Limit
      if (fileBuffer.length > 5 * 1024 * 1024) {
        return reject(new Error('Datei ist zu gross (max 5MB)'));
      }

      if (!['image/jpeg', 'image/png'].includes(mimeType)) {
        return reject(new Error('Nur JPEG und PNG sind erlaubt'));
      }

      resolve({ buffer: fileBuffer, mimeType });
    });

    req.on('error', err => reject(err));
  });
}

module.exports = { parseMultipartImage };
