const cloudinary = require('cloudinary').v2;

const hasCredentials = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (hasCredentials) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn('⚠️ Cloudinary credentials missing. Storage service will use fallback mock URLs.');
}

/**
 * Pipeline file buffer directly from memory to Cloudinary using upload_stream.
 * @param {Buffer} fileBuffer
 * @param {Object} options Cloudinary upload options
 * @returns {Promise<Object>}
 */
const uploadStream = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!hasCredentials) {
      const publicId = `mock_${Date.now()}`;
      const ext = options.format || 'png';
      return resolve({
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/demo/image/upload/v1234567890/${publicId}.${ext}`,
      });
    }

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(fileBuffer);
  });
};

/**
 * Extract public ID from a Cloudinary URL
 * @param {string} url 
 * @returns {string|null}
 */
const extractPublicId = (url) => {
  if (!url) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
};

/**
 * Deletes a file from Cloudinary by URL
 * @param {string} url 
 * @returns {Promise<Object>}
 */
const deleteFile = async (url) => {
  if (!hasCredentials) return { result: 'ok_mock' };
  const publicId = extractPublicId(url);
  if (!publicId) return null;

  return new Promise((resolve, reject) => {
    const resourceType = url.includes('/raw/') ? 'raw' : 'image';
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

/**
 * Standardized wrapper converting memory buffers directly into Cloudinary asset targets.
 * @param {Buffer} fileBuffer 
 * @param {string} customPath 
 * @returns {Promise<Object>}
 */
const uploadFile = async (fileBuffer, customPath) => {
  const options = {
    resource_type: 'auto', // ⚡ Tells Cloudinary to automatically accept PDFs and documents
    public_id: customPath ? customPath.replace(/\.[^/.]+$/, "") : `report_${Date.now()}`
  };

  const result = await uploadStream(fileBuffer, options);
  return { url: result.secure_url, public_id: result.public_id };
};

module.exports = {
  uploadStream,
  deleteFile,
  uploadFile,
};
