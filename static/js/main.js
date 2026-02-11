/**
 * Image Editor Frontend Logic
 * Handles file upload, drag-and-drop, and API communication
 */

// Global state
let currentFilename = null;
let cropMode = false;
let adjustmentTimeout = null; // Debounce timer for real-time adjustments

// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const editorSection = document.getElementById('editor-section');
const imagePreview = document.getElementById('image-preview');
const loadingOverlay = document.getElementById('loading-overlay');

// Image info elements
const infoDimensions = document.getElementById('info-dimensions');
const infoSize = document.getElementById('info-size');
const infoFormat = document.getElementById('info-format');

// Slider elements
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');
const contrastSlider = document.getElementById('contrast-slider');
const contrastValue = document.getElementById('contrast-value');
const saturationSlider = document.getElementById('saturation-slider');
const saturationValue = document.getElementById('saturation-value');
const sharpnessSlider = document.getElementById('sharpness-slider');
const sharpnessValue = document.getElementById('sharpness-value');
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');

// Initialize event listeners
function init() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Real-time adjustment sliders
    brightnessSlider.addEventListener('input', handleAdjustmentChange);
    contrastSlider.addEventListener('input', handleAdjustmentChange);
    saturationSlider.addEventListener('input', handleAdjustmentChange);
    sharpnessSlider.addEventListener('input', handleAdjustmentChange);

    // Update value displays
    brightnessSlider.addEventListener('input', (e) => {
        brightnessValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });
    contrastSlider.addEventListener('input', (e) => {
        contrastValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });
    saturationSlider.addEventListener('input', (e) => {
        saturationValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });
    sharpnessSlider.addEventListener('input', (e) => {
        sharpnessValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });

    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value + '%';
    });

    // Crop input listeners - update crop box when values change
    ['crop-x', 'crop-y', 'crop-width', 'crop-height'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                if (cropMode) {
                    updateCropBox();
                }
                // Mark as custom when manually adjusting
                document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));
                const customBtn = document.querySelector('.btn-preset[onclick*="custom"]');
                if (customBtn) customBtn.classList.add('active');
            });
        }
    });
}

// Show selected tool and hide others
function showTool(toolName) {
    // Hide all tool cards
    document.querySelectorAll('.tool-card').forEach(card => {
        card.classList.add('hidden');
    });

    // Show the selected tool card
    const selectedTool = document.getElementById(`tool-${toolName}`);
    if (selectedTool) {
        selectedTool.classList.remove('hidden');
    }

    // Update selector card active states
    document.querySelectorAll('.selector-card').forEach(card => {
        card.classList.remove('active');
    });

    // Add active class to clicked selector
    event.target.closest('.selector-card').classList.add('active');
}

// Handle real-time adjustment changes
function handleAdjustmentChange() {
    // Debounce: Wait 300ms after user stops moving slider
    clearTimeout(adjustmentTimeout);
    adjustmentTimeout = setTimeout(() => {
        if (currentFilename) {
            applyAllAdjustments();
        }
    }, 300);
}

// Apply all adjustments in real-time
async function applyAllAdjustments() {
    if (!currentFilename) return;

    const brightness = parseFloat(brightnessSlider.value);
    const contrast = parseFloat(contrastSlider.value);
    const saturation = parseFloat(saturationSlider.value);
    const sharpness = parseFloat(sharpnessSlider.value);

    // Show subtle loading (no overlay to keep it smooth)
    imagePreview.style.opacity = '0.7';

    try {
        const response = await fetch('/preview-adjustments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: currentFilename,
                brightness: brightness,
                contrast: contrast,
                saturation: saturation,
                sharpness: sharpness
            })
        });

        const data = await response.json();

        if (data.success) {
            updatePreview(data.preview, data.info);
        } else {
            showNotification(data.error || 'Adjustment failed', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    } finally {
        imagePreview.style.opacity = '1';
    }
}

// Reset all adjustments to default
function resetAdjustments() {
    brightnessSlider.value = 1;
    brightnessValue.textContent = '1.0x';
    contrastSlider.value = 1;
    contrastValue.textContent = '1.0x';
    saturationSlider.value = 1;
    saturationValue.textContent = '1.0x';
    sharpnessSlider.value = 1;
    sharpnessValue.textContent = '1.0x';

    if (currentFilename) {
        applyAllAdjustments();
        showNotification('Adjustments reset!', 'info');
    }
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

// Upload file to server
async function uploadFile(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Invalid file type. Please upload JPG, PNG, or WEBP.', 'error');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File size exceeds 10MB limit.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    showLoading(true);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            currentFilename = data.filename;
            updatePreview(data.preview, data.info);
            showEditor();
            showNotification('Image uploaded successfully!', 'success');
        } else {
            showNotification(data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showNotification('Upload error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Update image preview and info
function updatePreview(previewSrc, info) {
    imagePreview.src = previewSrc;

    if (info) {
        infoDimensions.textContent = `${info.width} × ${info.height}px`;
        infoSize.textContent = info.size_kb >= 1024
            ? `${info.size_mb} MB`
            : `${info.size_kb} KB`;
        infoFormat.textContent = info.format;

        // Update crop max values
        document.getElementById('crop-width').max = info.width;
        document.getElementById('crop-height').max = info.height;
        document.getElementById('crop-x').max = info.width;
        document.getElementById('crop-y').max = info.height;
    }
}

// Show editor section
function showEditor() {
    uploadSection.classList.add('hidden');
    editorSection.classList.remove('hidden');
}

// Show upload section
function showUpload() {
    editorSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
}

// Apply brightness adjustment (legacy - now using applyAllAdjustments)
async function applyBrightness() {
    applyAllAdjustments();
}

// Apply compression
async function applyCompression() {
    if (!currentFilename) return;

    const quality = parseInt(qualitySlider.value);
    const targetSize = document.getElementById('target-size').value;
    const sizeUnit = document.getElementById('size-unit').value;
    const outputFormat = document.getElementById('output-format').value;

    const payload = {
        filename: currentFilename,
        quality: quality,
        outputFormat: outputFormat
    };

    // Convert target size to KB
    if (targetSize && targetSize > 0) {
        let sizeInKB = parseInt(targetSize);
        if (sizeUnit === 'MB') {
            sizeInKB = sizeInKB * 1024; // Convert MB to KB
        }
        payload.maxSizeKB = sizeInKB;
    }

    showLoading(true);

    try {
        const response = await fetch('/compress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            updatePreview(data.preview, data.info);

            // Update filename if format changed
            if (data.newFilename && data.newFilename !== currentFilename) {
                currentFilename = data.newFilename;
            }

            let message = `Converted to ${data.format}!`;
            if (data.qualityUsed !== quality) {
                message += ` Quality: ${data.qualityUsed}% (adjusted for target size)`;
            } else {
                message += ` Quality: ${quality}%`;
            }

            showNotification(message, 'success');
        } else {
            showNotification(data.error || 'Compression failed', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Set crop preset (landscape, portrait, square, custom)
function setCropPreset(preset) {
    if (!currentFilename) return;

    // Get current image dimensions
    const img = document.getElementById('image-preview');
    const imgWidth = parseInt(document.getElementById('crop-width').max) || 800;
    const imgHeight = parseInt(document.getElementById('crop-height').max) || 600;

    // Remove active class from all preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));

    let width, height, x, y;

    switch (preset) {
        case 'landscape':
            // 16:9 aspect ratio
            width = imgWidth;
            height = Math.round(imgWidth * 9 / 16);
            if (height > imgHeight) {
                height = imgHeight;
                width = Math.round(imgHeight * 16 / 9);
            }
            x = Math.round((imgWidth - width) / 2);
            y = Math.round((imgHeight - height) / 2);
            // Highlight landscape button
            event.target.classList.add('active');
            break;

        case 'portrait':
            // 9:16 aspect ratio
            height = imgHeight;
            width = Math.round(imgHeight * 9 / 16);
            if (width > imgWidth) {
                width = imgWidth;
                height = Math.round(imgWidth * 16 / 9);
            }
            x = Math.round((imgWidth - width) / 2);
            y = Math.round((imgHeight - height) / 2);
            event.target.classList.add('active');
            break;

        case 'square':
            // 1:1 aspect ratio
            const size = Math.min(imgWidth, imgHeight);
            width = size;
            height = size;
            x = Math.round((imgWidth - width) / 2);
            y = Math.round((imgHeight - height) / 2);
            event.target.classList.add('active');
            break;

        case 'custom':
            // Just highlight the custom button, don't change values
            event.target.classList.add('active');
            return;

        default:
            return;
    }

    // Update input fields
    document.getElementById('crop-x').value = x;
    document.getElementById('crop-y').value = y;
    document.getElementById('crop-width').value = width;
    document.getElementById('crop-height').value = height;

    // Update crop box if preview is visible
    if (cropMode) {
        updateCropBox();
    }

    showNotification(`${preset.charAt(0).toUpperCase() + preset.slice(1)} preset applied!`, 'info');
}

// Crop interaction state
let cropDragState = null;
let actualImageWidth = 0;
let actualImageHeight = 0;

// Get scale factor between displayed image and actual image
function getImageScale() {
    const imgElement = document.getElementById('image-preview');
    const displayedWidth = imgElement.clientWidth;
    const displayedHeight = imgElement.clientHeight;

    if (actualImageWidth === 0 || actualImageHeight === 0) {
        return { scaleX: 1, scaleY: 1 };
    }

    return {
        scaleX: displayedWidth / actualImageWidth,
        scaleY: displayedHeight / actualImageHeight
    };
}

// Get image offset within container (for centering)
function getImageOffset() {
    const container = document.getElementById('image-preview-container');
    const imgElement = document.getElementById('image-preview');

    const containerRect = container.getBoundingClientRect();
    const imgRect = imgElement.getBoundingClientRect();

    return {
        left: imgRect.left - containerRect.left,
        top: imgRect.top - containerRect.top
    };
}

// Update crop box position/size based on actual image coordinates
function updateCropBox() {
    const cropBox = document.getElementById('crop-box');
    const cropOverlay = document.getElementById('crop-overlay');
    const imgElement = document.getElementById('image-preview');

    if (!imgElement.naturalWidth) return;

    const x = parseInt(document.getElementById('crop-x').value) || 0;
    const y = parseInt(document.getElementById('crop-y').value) || 0;
    const width = parseInt(document.getElementById('crop-width').value) || 100;
    const height = parseInt(document.getElementById('crop-height').value) || 100;

    const scale = getImageScale();
    const offset = getImageOffset();

    // Convert actual image coordinates to displayed coordinates
    const displayX = x * scale.scaleX + offset.left;
    const displayY = y * scale.scaleY + offset.top;
    const displayWidth = width * scale.scaleX;
    const displayHeight = height * scale.scaleY;

    cropBox.style.left = displayX + 'px';
    cropBox.style.top = displayY + 'px';
    cropBox.style.width = displayWidth + 'px';
    cropBox.style.height = displayHeight + 'px';

    // Update info display
    const dimensionsDisplay = document.getElementById('crop-dimensions-display');
    if (dimensionsDisplay) {
        dimensionsDisplay.textContent = `${width} × ${height}`;
    }
}

// Update input fields from crop box position
function updateCropInputsFromBox() {
    const cropBox = document.getElementById('crop-box');
    const scale = getImageScale();
    const offset = getImageOffset();

    const displayX = parseFloat(cropBox.style.left) || 0;
    const displayY = parseFloat(cropBox.style.top) || 0;
    const displayWidth = parseFloat(cropBox.style.width) || 100;
    const displayHeight = parseFloat(cropBox.style.height) || 100;

    // Convert displayed coordinates to actual image coordinates
    const x = Math.round((displayX - offset.left) / scale.scaleX);
    const y = Math.round((displayY - offset.top) / scale.scaleY);
    const width = Math.round(displayWidth / scale.scaleX);
    const height = Math.round(displayHeight / scale.scaleY);

    document.getElementById('crop-x').value = Math.max(0, x);
    document.getElementById('crop-y').value = Math.max(0, y);
    document.getElementById('crop-width').value = Math.max(1, width);
    document.getElementById('crop-height').value = Math.max(1, height);

    // Update dimensions display
    const dimensionsDisplay = document.getElementById('crop-dimensions-display');
    if (dimensionsDisplay) {
        dimensionsDisplay.textContent = `${Math.max(1, width)} × ${Math.max(1, height)}`;
    }
}

// Initialize crop interaction
function initCropInteraction() {
    const cropBox = document.getElementById('crop-box');
    const container = document.getElementById('image-preview-container');

    if (!cropBox || !container) return;

    // Drag crop box
    cropBox.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();
        startCropDrag(e, 'move');
    });

    // Handle resize
    document.querySelectorAll('.crop-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const handleType = handle.dataset.handle;
            startCropDrag(e, handleType);
        });
    });

    // Mouse move/up on document
    document.addEventListener('mousemove', handleCropMouseMove);
    document.addEventListener('mouseup', handleCropMouseUp);
}

function startCropDrag(e, type) {
    const cropBox = document.getElementById('crop-box');
    const imgElement = document.getElementById('image-preview');
    const offset = getImageOffset();

    cropDragState = {
        type: type,
        startX: e.clientX,
        startY: e.clientY,
        boxLeft: parseFloat(cropBox.style.left) || 0,
        boxTop: parseFloat(cropBox.style.top) || 0,
        boxWidth: parseFloat(cropBox.style.width) || 100,
        boxHeight: parseFloat(cropBox.style.height) || 100,
        imgOffset: offset,
        imgWidth: imgElement.clientWidth,
        imgHeight: imgElement.clientHeight
    };
}

function handleCropMouseMove(e) {
    if (!cropDragState) return;

    const cropBox = document.getElementById('crop-box');
    const dx = e.clientX - cropDragState.startX;
    const dy = e.clientY - cropDragState.startY;

    const { imgOffset, imgWidth, imgHeight } = cropDragState;
    const minSize = 30;

    let newLeft = cropDragState.boxLeft;
    let newTop = cropDragState.boxTop;
    let newWidth = cropDragState.boxWidth;
    let newHeight = cropDragState.boxHeight;

    switch (cropDragState.type) {
        case 'move':
            newLeft = cropDragState.boxLeft + dx;
            newTop = cropDragState.boxTop + dy;
            break;
        case 'tl':
            newLeft = cropDragState.boxLeft + dx;
            newTop = cropDragState.boxTop + dy;
            newWidth = cropDragState.boxWidth - dx;
            newHeight = cropDragState.boxHeight - dy;
            break;
        case 'tr':
            newTop = cropDragState.boxTop + dy;
            newWidth = cropDragState.boxWidth + dx;
            newHeight = cropDragState.boxHeight - dy;
            break;
        case 'bl':
            newLeft = cropDragState.boxLeft + dx;
            newWidth = cropDragState.boxWidth - dx;
            newHeight = cropDragState.boxHeight + dy;
            break;
        case 'br':
            newWidth = cropDragState.boxWidth + dx;
            newHeight = cropDragState.boxHeight + dy;
            break;
        case 't':
            newTop = cropDragState.boxTop + dy;
            newHeight = cropDragState.boxHeight - dy;
            break;
        case 'b':
            newHeight = cropDragState.boxHeight + dy;
            break;
        case 'l':
            newLeft = cropDragState.boxLeft + dx;
            newWidth = cropDragState.boxWidth - dx;
            break;
        case 'r':
            newWidth = cropDragState.boxWidth + dx;
            break;
    }

    // Constrain to image bounds
    if (newWidth < minSize) newWidth = minSize;
    if (newHeight < minSize) newHeight = minSize;

    if (newLeft < imgOffset.left) newLeft = imgOffset.left;
    if (newTop < imgOffset.top) newTop = imgOffset.top;

    if (newLeft + newWidth > imgOffset.left + imgWidth) {
        if (cropDragState.type === 'move') {
            newLeft = imgOffset.left + imgWidth - newWidth;
        } else {
            newWidth = imgOffset.left + imgWidth - newLeft;
        }
    }

    if (newTop + newHeight > imgOffset.top + imgHeight) {
        if (cropDragState.type === 'move') {
            newTop = imgOffset.top + imgHeight - newHeight;
        } else {
            newHeight = imgOffset.top + imgHeight - newTop;
        }
    }

    cropBox.style.left = newLeft + 'px';
    cropBox.style.top = newTop + 'px';
    cropBox.style.width = newWidth + 'px';
    cropBox.style.height = newHeight + 'px';

    updateCropInputsFromBox();
}

function handleCropMouseUp() {
    cropDragState = null;
}

// Toggle crop mode
function toggleCropMode() {
    const cropOverlay = document.getElementById('crop-overlay');
    const toggleText = document.getElementById('crop-toggle-text');
    const imgElement = document.getElementById('image-preview');

    cropMode = !cropMode;

    if (cropMode) {
        // Store actual image dimensions
        actualImageWidth = imgElement.naturalWidth;
        actualImageHeight = imgElement.naturalHeight;

        // Set default crop to full image if not set
        const cropWidth = document.getElementById('crop-width');
        const cropHeight = document.getElementById('crop-height');
        if (parseInt(cropWidth.value) === 800 && parseInt(cropHeight.value) === 600) {
            cropWidth.value = actualImageWidth;
            cropHeight.value = actualImageHeight;
            document.getElementById('crop-x').value = 0;
            document.getElementById('crop-y').value = 0;
        }

        cropOverlay.classList.remove('hidden');
        toggleText.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" x2="23" y1="1" y2="23"/></svg> Hide Preview';

        // Initialize interactive crop
        initCropInteraction();
        updateCropBox();

        showNotification('Crop preview enabled. Drag the box or use handles to adjust.', 'info');
    } else {
        cropOverlay.classList.add('hidden');
        toggleText.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg> Show Preview';
        showNotification('Crop preview disabled.', 'info');
    }
}

// Apply crop
async function applyCrop() {
    if (!currentFilename) return;

    const x = parseInt(document.getElementById('crop-x').value) || 0;
    const y = parseInt(document.getElementById('crop-y').value) || 0;
    const width = parseInt(document.getElementById('crop-width').value) || 100;
    const height = parseInt(document.getElementById('crop-height').value) || 100;

    if (width <= 0 || height <= 0) {
        showNotification('Width and height must be greater than 0', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch('/crop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: currentFilename,
                x: x,
                y: y,
                width: width,
                height: height
            })
        });

        const data = await response.json();

        if (data.success) {
            updatePreview(data.preview, data.info);

            // Disable crop mode after applying
            cropMode = false;
            document.getElementById('crop-overlay').classList.add('hidden');

            showNotification('Image cropped!', 'success');
        } else {
            showNotification(data.error || 'Crop failed', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Download image
async function downloadImage() {
    if (!currentFilename) {
        showNotification('No image to download', 'error');
        return;
    }

    showLoading(true);

    try {
        const downloadUrl = `/download/${currentFilename}`;
        const response = await fetch(downloadUrl);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Download failed');
        }

        // Get the blob and create download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `edited_${currentFilename}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        showNotification('Download started!', 'success');
    } catch (error) {
        showNotification('Download error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Reset editor
async function resetEditor() {
    if (currentFilename) {
        try {
            await fetch(`/reset/${currentFilename}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }

    // Reset state
    currentFilename = null;
    cropMode = false;
    imagePreview.src = '';
    fileInput.value = '';

    // Reset sliders
    brightnessSlider.value = 1;
    brightnessValue.textContent = '1.0x';
    contrastSlider.value = 1;
    contrastValue.textContent = '1.0x';
    saturationSlider.value = 1;
    saturationValue.textContent = '1.0x';
    sharpnessSlider.value = 1;
    sharpnessValue.textContent = '1.0x';
    qualitySlider.value = 85;
    qualityValue.textContent = '85%';
    document.getElementById('target-size').value = '';

    // Reset crop values
    document.getElementById('crop-x').value = 0;
    document.getElementById('crop-y').value = 0;
    document.getElementById('crop-width').value = 800;
    document.getElementById('crop-height').value = 600;

    // Reset preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));
    const customBtn = document.querySelector('.btn-preset[onclick*="custom"]');
    if (customBtn) customBtn.classList.add('active');

    // Hide crop overlay
    document.getElementById('crop-overlay').classList.add('hidden');

    // Show upload section
    showUpload();

    showNotification('Editor reset. Upload a new image.', 'info');
}

// Show loading overlay
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
