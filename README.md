# 🖼️ Image Compressor & Editor

A powerful web application built with Python Flask that allows users to upload, edit, compress, and crop images with an intuitive interface.

## ✨ Features

- **Image Upload**: Support for JPG, PNG, and WEBP formats (up to 10MB)
- **Brightness Control**: Adjust image brightness with real-time preview
- **Image Compression**: Reduce file size with quality control or target size
- **Crop Tool**: Crop images to custom dimensions
- **Live Preview**: See changes before downloading
- **Download**: Save edited images to your device

## 📁 Project Structure

```
image-editor/
├── app.py                      # Main Flask application
├── requirements.txt            # Python dependencies
├── utils/
│   └── image_processor.py     # Image processing utilities
├── templates/
│   └── index.html             # Main UI page
├── static/
│   ├── css/
│   │   └── style.css          # Styling
│   ├── js/
│   │   └── main.js            # Frontend logic
│   └── uploads/               # Temporary image storage
│       └── .gitkeep
└── README.md
```

## 🚀 How to Run Locally

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation Steps

1. **Navigate to the project directory:**
   ```bash
   cd image-editor
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask application:**
   ```bash
   python app.py
   ```

4. **Open your browser and visit:**
   ```
   http://localhost:5000
   ```

## 🎯 How to Use

### 1. Upload an Image
- Click "Choose File" or drag & drop an image onto the upload area
- Supported formats: JPG, PNG, WEBP (max 10MB)

### 2. Adjust Brightness
- Use the brightness slider (0.5x to 2.0x)
- Click "Apply Brightness" to see changes

### 3. Compress Image
- Set compression quality (10% to 100%)
- Optionally set a target size in KB
- Click "Apply Compression"

### 4. Crop Image
- Enter X, Y coordinates and width/height
- Click "Toggle Crop Preview" to visualize
- Click "Apply Crop" to crop

### 5. Download
- Click "Download Image" to save your edited image

### 6. Start Over
- Click "New Image" to upload a different image

## 🔧 Technical Details

### Backend (Flask + Pillow)

**app.py** - Main application with routes:
- `GET /` - Serve main page
- `POST /upload` - Handle image upload
- `POST /adjust-brightness` - Adjust brightness
- `POST /compress` - Compress image
- `POST /crop` - Crop image
- `GET /download/<filename>` - Download edited image
- `DELETE /reset/<filename>` - Clean up file

**utils/image_processor.py** - Image processing functions:
- `allowed_file()` - Validate file extensions
- `image_to_base64()` - Convert image for preview
- `get_image_info()` - Extract metadata
- `adjust_brightness()` - Brightness adjustment using PIL ImageEnhance
- `compress_image()` - Quality-based compression with optional target size
- `crop_image()` - Crop to specified dimensions
- `save_image()` - Save processed image

### Frontend (HTML/CSS/JavaScript)

**index.html** - Single-page interface with:
- Upload zone with drag & drop
- Preview panel
- Control panels for editing
- Responsive design

**style.css** - Modern styling:
- Gradient backgrounds
- Smooth animations
- Responsive layout
- Custom sliders and buttons

**main.js** - Client-side logic:
- Drag & drop file handling
- Fetch API for backend communication
- Real-time preview updates
- User notifications

## 🔒 Security Features

- File type validation (whitelist approach)
- File size limit (10MB)
- Secure filename generation with UUID
- Path traversal prevention
- Temporary file storage

## 📊 Data Flow

```
User uploads image
    ↓
Flask validates (type, size)
    ↓
Save to /static/uploads with UUID filename
    ↓
Pillow opens image & converts to base64
    ↓
Return preview to frontend
    ↓
User adjusts settings (brightness/compression/crop)
    ↓
POST to respective Flask route
    ↓
Pillow processes image
    ↓
Save updated image (overwrites)
    ↓
Return new preview to frontend
    ↓
User downloads edited image
    ↓
Flask sends file as attachment
```

## 🛠️ Code Explanation

### Image Upload Flow

1. **Frontend** (`main.js`):
   - User selects/drops file
   - Validate file type and size
   - Create FormData and POST to `/upload`

2. **Backend** (`app.py`):
   ```python
   @app.route('/upload', methods=['POST'])
   def upload_image():
       file = request.files['image']
       # Validate
       # Generate UUID filename
       # Save file
       # Return preview + metadata
   ```

3. **Image Processing** (`image_processor.py`):
   ```python
   def image_to_base64(image):
       # Convert PIL Image to base64 string
       # Used for frontend preview
   ```

### Brightness Adjustment

1. **Frontend**: POST brightness factor to `/adjust-brightness`

2. **Backend**:
   ```python
   @app.route('/adjust-brightness', methods=['POST'])
   def brightness():
       brightness_factor = request.json['brightness']
       adjusted_img = adjust_brightness(filepath, brightness_factor)
   ```

3. **Processing**:
   ```python
   def adjust_brightness(image_path, brightness_factor):
       img = Image.open(image_path)
       enhancer = ImageEnhance.Brightness(img)
       return enhancer.enhance(brightness_factor)
   ```

### Image Compression

1. **Frontend**: POST quality (and optional maxSizeKB) to `/compress`

2. **Backend**: Calls `compress_image()` with parameters

3. **Processing**:
   ```python
   def compress_image(image_path, quality=85, max_size_kb=None):
       img = Image.open(image_path)
       # Convert RGBA to RGB for JPEG
       # If max_size_kb specified, iteratively reduce quality
       # Save with optimize=True
   ```

### Image Cropping

1. **Frontend**: POST x, y, width, height to `/crop`

2. **Backend**: Calls `crop_image()` with coordinates

3. **Processing**:
   ```python
   def crop_image(image_path, x, y, width, height):
       img = Image.open(image_path)
       crop_box = (x, y, x + width, y + height)
       return img.crop(crop_box)
   ```

## 📦 Dependencies

- **Flask 3.0.0** - Web framework
- **Pillow 10.1.0** - Image processing library
- **Werkzeug 3.0.1** - WSGI utilities (included with Flask)

## 🎨 UI Features

- **Gradient Design**: Modern purple gradient background
- **Drag & Drop**: Intuitive file upload
- **Real-time Sliders**: Live value updates
- **Loading States**: Visual feedback during processing
- **Notifications**: Success/error/info messages
- **Responsive**: Works on desktop and mobile

## 🔄 Future Enhancements

Potential features to add:
- Rotation and flip tools
- Filters (grayscale, sepia, blur)
- Batch processing multiple images
- Before/after comparison view
- Image format conversion
- Automatic cleanup of old files
- User sessions for image history

## 📝 License

This project is open source and available for educational purposes.

## 👨‍💻 Author

**DARSHAN** - [@DARSHAN0067](https://github.com/DARSHAN0067)

Built with Flask + Pillow to demonstrate powerful image processing capabilities.

---

**Enjoy editing your images! 🎉**
