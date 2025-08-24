import React, { useState } from "react";
import axios from "axios";

const API = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
    ? window.location.origin  // Uses same domain in production
    : "http://127.0.0.1:8000", // Development fallback
  headers: { "Content-Type": "multipart/form-data" }  // ← ADD THIS LINE!
});

function App() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const SUPPORTED_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif'
  ];

  const validateAndProcessFile = (file) => {
    setFileError(null);

    if (!file) {
      setImage(null);
      setImagePreview(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError("File size must be less than 10MB");
      return;
    }

    const isImage = file.type.startsWith('image/') ||
                   file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|heif)$/);

    if (!isImage) {
      setFileError("Please select a valid image file");
      return;
    }

    setImage(file);

    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name.toLowerCase().match(/\.(heic|heif)$/)) {
      setImagePreview(null);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.onerror = () => {
        setFileError("Failed to read image file");
        setImagePreview(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    validateAndProcessFile(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      validateAndProcessFile(file);

      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
    }
  };

  const classifyImage = async () => {
    if (!image) return alert("Please select an image first");
    const formData = new FormData();
    formData.append("image", image);
    setLoading(true);
    setActiveTask("classify");
    try {
      const res = await API.post("/api/task1/classify", formData);
      setResult({ type: "classification", data: res.data });
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      alert(`Classification failed: ${errorMsg}`);
      console.error("Classification error:", err);
    } finally {
      setLoading(false);
      setActiveTask(null);
    }
  };

  const searchImage = async () => {
    if (!image) return alert("Please select an image first");
    const formData = new FormData();
    formData.append("image", image);
    setLoading(true);
    setActiveTask("search");
    try {
      const res = await API.post("/api/task2/search", formData);
      setResult({ type: "search", data: res.data });
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      alert(`Search failed: ${errorMsg}`);
      console.error("Search error:", err);
    } finally {
      setLoading(false);
      setActiveTask(null);
    }
  };

  const testConnection = async () => {
    try {
      const res = await API.get("/health");
      alert("Backend OK: " + JSON.stringify(res.data));
    } catch (err) {
      alert("Backend connection failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.type === "classification") {
      const { label, probability, shop_prob, not_shop_prob, shop_names } = result.data.data;
      return (
        <div className="glass-card result-card animate-slide-up">
          <div className="result-header">
            <div className="result-icon">🔍</div>
            <h3 className="result-title">Classification Analysis</h3>
          </div>

          <div className="prediction-container">
            <div className={`prediction-badge ${label === 'shop' ? 'success' : 'danger'}`}>
              <div className="badge-icon">{label === 'shop' ? '🏪' : '❌'}</div>
              <div className="badge-text">{label === 'shop' ? 'SHOP DETECTED' : 'NOT A SHOP'}</div>
            </div>
            <div className="confidence-score">
              {(probability * 100).toFixed(1)}% confidence
            </div>
          </div>

          {label === 'shop' && shop_names && shop_names.length > 0 && (
            <div className="shop-names-section">
              <h4 className="section-title">🏷️ Detected Shop Names</h4>
              <div className="shop-tags">
                {shop_names.map((name, idx) => (
                  <span key={idx} className="shop-tag">{name}</span>
                ))}
              </div>
            </div>
          )}

          <div className="probability-section">
            <div className="prob-item">
              <div className="prob-header">
                <span className="prob-label">Shop Probability</span>
                <span className="prob-value">{(shop_prob * 100).toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill success-fill"
                  style={{ width: `${shop_prob * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="prob-item">
              <div className="prob-header">
                <span className="prob-label">Not Shop Probability</span>
                <span className="prob-value">{(not_shop_prob * 100).toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill danger-fill"
                  style={{ width: `${not_shop_prob * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (result.type === "search") {
      const { exists, best_similarity, results, shop_names } = result.data.data;
      return (
        <div className="glass-card result-card animate-slide-up">
          <div className="result-header">
            <div className="result-icon">🔎</div>
            <h3 className="result-title">Similarity Search Results</h3>
          </div>

          <div className="prediction-container">
            <div className={`prediction-badge ${exists ? 'success' : 'danger'}`}>
              <div className="badge-icon">{exists ? '✅' : '❌'}</div>
              <div className="badge-text">{exists ? 'MATCH FOUND' : 'NO MATCH'}</div>
            </div>
            <div className="confidence-score">
              Best similarity: {(best_similarity * 100).toFixed(1)}%
            </div>
          </div>

          {exists && shop_names && shop_names.length > 0 && (
            <div className="shop-names-section">
              <h4 className="section-title">🏷️ Detected Shop Names</h4>
              <div className="shop-tags">
                {shop_names.map((name, idx) => (
                  <span key={idx} className="shop-tag">{name}</span>
                ))}
              </div>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="matches-section">
              <h4 className="section-title">Top Matches</h4>
              <div className="matches-grid">
                {results.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="match-card">
                    <div className="match-rank">#{item.rank}</div>
                    <div className="match-score">{(item.similarity * 100).toFixed(1)}%</div>
                    <div className="match-path">{item.image.split('/').pop()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  };

  const getFileTypeInfo = (file) => {
    if (!file) return null;
    const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' ||
                   file.name.toLowerCase().match(/\.(heic|heif)$/);
    return isHEIC ?
      { type: 'HEIC/HEIF', canPreview: false, note: 'Preview not available for HEIC files' } :
      { type: file.type.split('/')[1]?.toUpperCase() || 'Unknown', canPreview: true, note: null };
  };

  const fileInfo = image ? getFileTypeInfo(image) : null;

  return (
    <div className="app">
      <div className="background-pattern"></div>
      <div className="container">
        {/* Header Section */}
        <header className="header animate-fade-in">
          <div className="brand-container">
            <div className="brand-icon"></div>
            <div className="brand-text">
              <h1 className="main-title">AI Vision</h1>
              <p className="subtitle">Advanced image classification and similarity search</p>
            </div>
          </div>
          <div className="feature-badges">
            <span className="feature-badge">HEIC Support</span>
            <span className="feature-badge">10MB Max</span>
            <span className="feature-badge">Real-time</span>
          </div>
        </header>

        {/* Upload Section */}
        <div className="upload-section animate-slide-up">
          <div
            className={`upload-container ${isDragOver ? 'drag-active' : ''} ${image ? 'has-image' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*,.heic,.heif"
              onChange={handleImageChange}
              id="file-input"
              className="file-input"
            />

            <label htmlFor="file-input" className="upload-label">
              {imagePreview ? (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" className="preview-image" />
                  <div className="image-overlay">
                    <div className="overlay-text">Click to change</div>
                  </div>
                </div>
              ) : image && fileInfo && !fileInfo.canPreview ? (
                <div className="heic-placeholder">
                  <div className="placeholder-icon">🖼️</div>
                  <div className="placeholder-title">{image.name}</div>
                  <div className="placeholder-note">{fileInfo.note}</div>
                  <div className="change-text">Click to change</div>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-animation">
                    <div className="upload-icon">📁</div>
                    <div className="upload-rings">
                      <div className="ring ring-1"></div>
                      <div className="ring ring-2"></div>
                      <div className="ring ring-3"></div>
                    </div>
                  </div>
                  <div className="upload-text">
                    <h3>{isDragOver ? 'Drop it like it\'s hot! 🔥' : 'Upload Your Image'}</h3>
                    <p>Drag & drop or click to browse</p>
                  </div>
                  <div className="supported-formats">
                    JPG • PNG • WEBP • GIF • BMP • TIFF • HEIC • HEIF
                  </div>
                </div>
              )}
            </label>
          </div>

          {fileError && (
            <div className="error-message animate-shake">
              <div className="error-icon">⚠️</div>
              <span>{fileError}</span>
            </div>
          )}

          {image && !fileError && (
            <div className="file-info animate-slide-up">
              <div className="file-details">
                <div className="file-name">📄 {image.name}</div>
                <div className="file-meta">{fileInfo?.type} • {(image.size / 1024).toFixed(1)} KB</div>
              </div>
              <div className="file-status">Ready</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="actions-section animate-slide-up">
          <button
            onClick={classifyImage}
            disabled={loading || !image || fileError}
            className={`action-btn primary ${activeTask === 'classify' ? 'loading' : ''} ${(!image || fileError) ? 'disabled' : ''}`}
          >
            <div className="btn-content">
              {activeTask === 'classify' ? (
                <>
                  <div className="spinner"></div>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <div className="btn-icon">🔍</div>
                  <span>Classify Image</span>
                </>
              )}
            </div>
            <div className="btn-shine"></div>
          </button>

          <button
            onClick={searchImage}
            disabled={loading || !image || fileError}
            className={`action-btn secondary ${activeTask === 'search' ? 'loading' : ''} ${(!image || fileError) ? 'disabled' : ''}`}
          >
            <div className="btn-content">
              {activeTask === 'search' ? (
                <>
                  <div className="spinner"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <div className="btn-icon">🔎</div>
                  <span>Find Similar</span>
                </>
              )}
            </div>
            <div className="btn-shine"></div>
          </button>
        </div>

        {/* Results Section */}
        {renderResult()}
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        .background-pattern {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.1) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .container {
          position: relative;
          z-index: 1;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 0.9; }
        }

        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        .animate-slide-up { animation: slideUp 0.6s ease-out; }
        .animate-shake { animation: shake 0.5s ease-in-out; }

        /* Header Styles */
        .header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .brand-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .brand-icon {
          font-size: 3rem;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        }

        .main-title {
          font-size: 3rem;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff, #f8f9ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
          text-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .subtitle {
          color: rgba(255,255,255,0.9);
          font-size: 1.1rem;
          margin: 0.5rem 0 0 0;
          font-weight: 400;
        }

        .feature-badges {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .feature-badge {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Upload Section */
        .upload-section {
          margin-bottom: 2.5rem;
        }

        .upload-container {
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(20px);
          border: 2px dashed rgba(102, 126, 234, 0.3);
          border-radius: 24px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          position: relative;
        }

        .upload-container:hover {
          border-color: rgba(102, 126, 234, 0.6);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .upload-container.drag-active {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
          transform: scale(1.02);
        }

        .file-input {
          display: none;
        }

        .upload-label {
          display: block;
          cursor: pointer;
          padding: 3rem 2rem;
          text-align: center;
        }

        .upload-placeholder {
          position: relative;
        }

        .upload-animation {
          position: relative;
          display: inline-block;
          margin-bottom: 1.5rem;
        }

        .upload-icon {
          font-size: 4rem;
          position: relative;
          z-index: 2;
        }

        .upload-rings {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .ring {
          position: absolute;
          border: 2px solid rgba(102, 126, 234, 0.2);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        .ring-1 { width: 80px; height: 80px; margin: -40px 0 0 -40px; animation-delay: 0s; }
        .ring-2 { width: 120px; height: 120px; margin: -60px 0 0 -60px; animation-delay: 0.5s; }
        .ring-3 { width: 160px; height: 160px; margin: -80px 0 0 -80px; animation-delay: 1s; }

        .upload-text h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
          margin: 0 0 0.5rem 0;
        }

        .upload-text p {
          color: #666;
          font-size: 1rem;
          margin: 0 0 1rem 0;
        }

        .supported-formats {
          color: #999;
          font-size: 0.85rem;
          font-weight: 500;
          letter-spacing: 0.5px;
        }

        .image-preview-container {
          position: relative;
          display: inline-block;
          border-radius: 16px;
          overflow: hidden;
        }

        .preview-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: 16px;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .image-preview-container:hover .image-overlay {
          opacity: 1;
        }

        .image-preview-container:hover .preview-image {
          transform: scale(1.05);
        }

        .overlay-text {
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .heic-placeholder {
          color: #667eea;
        }

        .placeholder-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .placeholder-title {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .placeholder-note {
          color: #999;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .change-text {
          color: #667eea;
          font-weight: 600;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 1rem;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          color: #dc2626;
          border-radius: 16px;
          border: 1px solid #f87171;
          font-weight: 500;
        }

        .error-icon {
          font-size: 1.2rem;
        }

        .file-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border-radius: 16px;
          border: 1px solid #7dd3fc;
        }

        .file-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .file-name {
          font-weight: 600;
          color: #0c4a6e;
        }

        .file-meta {
          font-size: 0.85rem;
          color: #0369a1;
        }

        .file-status {
          background: #10b981;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Action Buttons */
        .actions-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2.5rem;
        }

        .action-btn {
          position: relative;
          border: none;
          border-radius: 16px;
          padding: 1rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .action-btn.secondary {
          background: linear-gradient(135deg, #f093fb, #f5576c);
          color: white;
          box-shadow: 0 8px 25px rgba(240, 147, 251, 0.4);
        }

        .action-btn:hover:not(.disabled) {
          transform: translateY(-4px);
          box-shadow: 0 12px 35px rgba(102, 126, 234, 0.5);
        }

        .action-btn.secondary:hover:not(.disabled) {
          box-shadow: 0 12px 35px rgba(240, 147, 251, 0.5);
        }

        .action-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .btn-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          position: relative;
          z-index: 2;
        }

        .btn-icon {
          font-size: 1.2rem;
        }

        .btn-shine {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transition: left 0.6s ease;
        }

        .action-btn:hover .btn-shine {
          left: 100%;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Glass Card Effect */
        .glass-card {
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 24px;
          padding: 2rem;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .result-card {
          margin-top: 2rem;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .result-icon {
          font-size: 2rem;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .result-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
          margin: 0;
        }

        .prediction-container {
          text-align: center;
          margin-bottom: 2rem;
        }

        .prediction-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 2rem;
          border-radius: 20px;
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .prediction-badge.success {
          background: linear-gradient(135deg, #10b981, #34d399);
          color: white;
        }

        .prediction-badge.danger {
          background: linear-gradient(135deg, #ef4444, #f87171);
          color: white;
        }

        .badge-icon {
          font-size: 1.2rem;
        }

        .confidence-score {
          font-size: 1.1rem;
          color: #666;
          font-weight: 500;
        }

        .shop-names-section {
          margin: 2rem 0;
          padding: 1.5rem;
          background: linear-gradient(135deg, #f8f9ff, #e0e7ff);
          border-radius: 16px;
          border: 1px solid #c7d2fe;
        }

        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
          margin: 0 0 1rem 0;
        }

        .shop-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .shop-tag {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          transition: transform 0.2s ease;
        }

        .shop-tag:hover {
          transform: translateY(-2px);
        }

        .probability-section {
          margin-top: 2rem;
        }

        .prob-item {
          margin-bottom: 1.5rem;
        }

        .prob-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .prob-label {
          font-weight: 600;
          color: #374151;
          font-size: 1rem;
        }

        .prob-value {
          font-weight: 700;
          color: #374151;
          font-size: 1rem;
        }

        .progress-bar {
          height: 12px;
          background: #f3f4f6;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          border-radius: 8px;
          transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 2s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .success-fill {
          background: linear-gradient(90deg, #10b981, #34d399);
        }

        .danger-fill {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }

        .matches-section {
          margin-top: 2rem;
        }

        .matches-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .match-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: linear-gradient(135deg, #f8f9ff, #ffffff);
          border-radius: 12px;
          border: 1px solid #e0e7ff;
          transition: all 0.3s ease;
        }

        .match-card:hover {
          transform: translateX(8px);
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
        }

        .match-rank {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          min-width: 40px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        .match-score {
          background: linear-gradient(135deg, #10b981, #34d399);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          min-width: 60px;
          text-align: center;
        }

        .match-path {
          flex: 1;
          color: #666;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 0.9rem;
          background: #f8f9fa;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }

          .main-title {
            font-size: 2.5rem;
          }

          .brand-container {
            flex-direction: column;
            gap: 0.5rem;
          }

          .actions-section {
            grid-template-columns: 1fr;
          }

          .upload-label {
            padding: 2rem 1rem;
          }

          .shop-tags {
            justify-content: center;
          }

          .match-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .prob-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }

        @media (max-width: 480px) {
          .main-title {
            font-size: 2rem;
          }

          .feature-badges {
            flex-direction: column;
            align-items: center;
          }

          .prediction-badge {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

export default App;