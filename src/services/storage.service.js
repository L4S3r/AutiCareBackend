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

module.exports = {
  uploadStream,
};
