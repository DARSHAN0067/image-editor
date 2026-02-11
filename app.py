"""
Flask Image Compressor & Editor Application
Main application file with all routes and endpoints
"""

import os
import uuid
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
from utils.image_processor import (
    allowed_file, 
    image_to_base64, 
    get_image_info,
    adjust_brightness,
    compress_image,
    crop_image,
    save_image
)
from PIL import Image

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


@app.route('/')
def index():
    """Render main page"""
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_image():
    """
    Handle image upload
    
    Expected: multipart/form-data with 'image' file
    Returns: JSON with image preview and metadata
    """
    try:
        # Check if file is in request
        if 'image' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['image']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: JPG, PNG, WEBP'}), 400
        
        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_ext = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save file
        file.save(filepath)
        
        # Also save as "original" for real-time adjustments
        original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"original_{unique_filename}")
        file.seek(0)  # Reset file pointer
        file.save(original_filepath)
        
        # Open image and get info
        img = Image.open(filepath)
        img_info = get_image_info(img)
        
        # Convert to base64 for preview
        preview = image_to_base64(img)
        
        return jsonify({
            'success': True,
            'filename': unique_filename,
            'preview': preview,
            'info': img_info
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/preview-adjustments', methods=['POST'])
def preview_adjustments():
    """
    Apply multiple adjustments in real-time without saving
    
    Expected JSON: {
        'filename': str,
        'brightness': float (0.5-2.0),
        'contrast': float (0.5-2.0),
        'saturation': float (0.0-2.0),
        'sharpness': float (0.0-2.0)
    }
    Returns: JSON with preview
    """
    try:
        data = request.json
        filename = data.get('filename')
        
        if not filename:
            return jsonify({'error': 'Filename required'}), 400
        
        # Load ORIGINAL image (not the modified one)
        original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"original_{filename}")
        
        if not os.path.exists(original_filepath):
            return jsonify({'error': 'Original file not found'}), 404
        
        # Open original image
        img = Image.open(original_filepath)
        
        # Convert to RGB if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        
        # Apply adjustments from PIL ImageEnhance
        from PIL import ImageEnhance
        
        # Brightness
        brightness = float(data.get('brightness', 1.0))
        if brightness != 1.0:
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(brightness)
        
        # Contrast
        contrast = float(data.get('contrast', 1.0))
        if contrast != 1.0:
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(contrast)
        
        # Saturation (Color)
        saturation = float(data.get('saturation', 1.0))
        if saturation != 1.0:
            enhancer = ImageEnhance.Color(img)
            img = enhancer.enhance(saturation)
        
        # Sharpness
        sharpness = float(data.get('sharpness', 1.0))
        if sharpness != 1.0:
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(sharpness)
        
        # Get updated info
        img_info = get_image_info(img)
        
        # Save adjusted image (overwrite working copy)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        save_image(img, filepath)
        
        # Return preview
        preview = image_to_base64(img)
        
        return jsonify({
            'success': True,
            'preview': preview,
            'info': img_info
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/adjust-brightness', methods=['POST'])
def brightness():
    """
    Adjust image brightness
    
    Expected JSON: {'filename': str, 'brightness': float}
    Returns: JSON with updated preview
    """
    try:
        data = request.json
        filename = data.get('filename')
        brightness_factor = float(data.get('brightness', 1.0))
        
        if not filename:
            return jsonify({'error': 'Filename required'}), 400
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Adjust brightness
        adjusted_img = adjust_brightness(filepath, brightness_factor)
        
        # Get updated info
        img_info = get_image_info(adjusted_img)
        
        # Save adjusted image (overwrite)
        save_image(adjusted_img, filepath)
        
        # Return preview
        preview = image_to_base64(adjusted_img)
        
        return jsonify({
            'success': True,
            'preview': preview,
            'info': img_info
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/compress', methods=['POST'])
def compress():
    """
    Compress image and optionally convert format
    
    Expected JSON: {
        'filename': str,
        'quality': int,
        'maxSizeKB': int (optional),
        'outputFormat': str (JPEG/PNG/WEBP)
    }
    Returns: JSON with compressed preview
    """
    try:
        data = request.json
        filename = data.get('filename')
        quality = int(data.get('quality', 85))
        max_size_kb = data.get('maxSizeKB')
        output_format = data.get('outputFormat', 'JPEG').upper()
        
        if not filename:
            return jsonify({'error': 'Filename required'}), 400
        
        # Get current filepath
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Compress image
        if max_size_kb:
            compressed_img, actual_quality = compress_image(
                filepath, 
                quality=quality, 
                max_size_kb=int(max_size_kb)
            )
            quality_used = actual_quality
        else:
            compressed_img, quality_used = compress_image(filepath, quality=quality)
        
        # Determine new filename based on format
        name_without_ext = filename.rsplit('.', 1)[0]
        format_to_ext = {
            'JPEG': 'jpg',
            'PNG': 'png',
            'WEBP': 'webp'
        }
        new_ext = format_to_ext.get(output_format, 'jpg')
        new_filename = f"{name_without_ext}.{new_ext}"
        new_filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
        
        # Save compressed image with new format
        save_image(compressed_img, new_filepath, format=output_format, quality=quality_used)
        
        # If format changed, update the filename and delete old file
        if new_filename != filename:
            if os.path.exists(filepath):
                os.remove(filepath)
            # Update original file as well
            old_original = os.path.join(app.config['UPLOAD_FOLDER'], f"original_{filename}")
            new_original = os.path.join(app.config['UPLOAD_FOLDER'], f"original_{new_filename}")
            if os.path.exists(old_original):
                os.rename(old_original, new_original)
        
        # Get updated info
        img_info = get_image_info(compressed_img)
        
        # Return preview
        preview = image_to_base64(compressed_img)
        
        return jsonify({
            'success': True,
            'preview': preview,
            'info': img_info,
            'qualityUsed': quality_used,
            'newFilename': new_filename,
            'format': output_format
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/crop', methods=['POST'])
def crop():
    """
    Crop image
    
    Expected JSON: {'filename': str, 'x': int, 'y': int, 'width': int, 'height': int}
    Returns: JSON with cropped preview
    """
    try:
        data = request.json
        filename = data.get('filename')
        x = int(data.get('x', 0))
        y = int(data.get('y', 0))
        width = int(data.get('width'))
        height = int(data.get('height'))
        
        if not filename:
            return jsonify({'error': 'Filename required'}), 400
        
        if not width or not height:
            return jsonify({'error': 'Width and height required'}), 400
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Crop image
        cropped_img = crop_image(filepath, x, y, width, height)
        
        # Save cropped image
        save_image(cropped_img, filepath)
        
        # Get updated info
        img_info = get_image_info(cropped_img)
        
        # Return preview
        preview = image_to_base64(cropped_img)
        
        return jsonify({
            'success': True,
            'preview': preview,
            'info': img_info
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download/<filename>')
def download(filename):
    """
    Download processed image
    
    Args:
        filename: Name of file to download
    """
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Convert to absolute path
        abs_filepath = os.path.abspath(filepath)
        
        if not os.path.exists(abs_filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Send file as download
        return send_file(
            abs_filepath,
            as_attachment=True,
            download_name=f"edited_{filename}"
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/reset/<filename>', methods=['DELETE'])
def reset(filename):
    """
    Delete uploaded file and its original backup
    
    Args:
        filename: Name of file to delete
    """
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"original_{filename}")
        
        if os.path.exists(filepath):
            os.remove(filepath)
        
        if os.path.exists(original_filepath):
            os.remove(original_filepath)
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
