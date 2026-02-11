"""
Image Processing Utilities
Handles all image manipulation operations using Pillow (PIL)
"""

import os
import io
import base64
from PIL import Image, ImageEnhance
from werkzeug.utils import secure_filename

# Allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def allowed_file(filename):
    """
    Check if file extension is allowed
    
    Args:
        filename (str): Name of the uploaded file
        
    Returns:
        bool: True if extension is allowed, False otherwise
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def image_to_base64(image):
    """
    Convert PIL Image to base64 string for frontend preview
    
    Args:
        image (PIL.Image): Image object
        
    Returns:
        str: Base64 encoded image string
    """
    buffered = io.BytesIO()
    # Save as PNG for lossless preview
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"


def get_image_info(image):
    """
    Get image metadata (size, dimensions, format)
    
    Args:
        image (PIL.Image): Image object
        
    Returns:
        dict: Image information
    """
    buffered = io.BytesIO()
    image.save(buffered, format=image.format or 'PNG')
    size_bytes = buffered.tell()
    
    return {
        'width': image.width,
        'height': image.height,
        'format': image.format or 'PNG',
        'size_kb': round(size_bytes / 1024, 2),
        'size_mb': round(size_bytes / (1024 * 1024), 2)
    }


def adjust_brightness(image_path, brightness_factor):
    """
    Adjust image brightness
    
    Args:
        image_path (str): Path to the image file
        brightness_factor (float): Brightness multiplier (0.5=darker, 1.0=original, 2.0=brighter)
        
    Returns:
        PIL.Image: Brightness-adjusted image
    """
    img = Image.open(image_path)
    
    # Convert to RGB if necessary (for PNG with transparency)
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background
    
    enhancer = ImageEnhance.Brightness(img)
    adjusted_img = enhancer.enhance(brightness_factor)
    
    return adjusted_img


def compress_image(image_path, quality=85, max_size_kb=None):
    """
    Compress image by reducing quality
    
    Args:
        image_path (str): Path to the image file
        quality (int): JPEG quality (1-100, lower = more compression)
        max_size_kb (int, optional): Target maximum file size in KB
        
    Returns:
        tuple: (PIL.Image, actual_quality_used)
    """
    img = Image.open(image_path)
    
    # Convert RGBA to RGB for JPEG compression
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background
    
    # If max_size_kb is specified, iteratively reduce quality
    if max_size_kb:
        current_quality = quality
        while current_quality > 10:
            buffered = io.BytesIO()
            img.save(buffered, format='JPEG', quality=current_quality, optimize=True)
            size_kb = buffered.tell() / 1024
            
            if size_kb <= max_size_kb:
                break
            
            # Reduce quality by 5% each iteration
            current_quality -= 5
        
        return img, current_quality
    
    return img, quality


def crop_image(image_path, x, y, width, height):
    """
    Crop image to specified dimensions
    
    Args:
        image_path (str): Path to the image file
        x (int): Left coordinate
        y (int): Top coordinate
        width (int): Crop width
        height (int): Crop height
        
    Returns:
        PIL.Image: Cropped image
    """
    img = Image.open(image_path)
    
    # Calculate crop box (left, top, right, bottom)
    crop_box = (x, y, x + width, y + height)
    
    # Ensure crop box is within image bounds
    crop_box = (
        max(0, crop_box[0]),
        max(0, crop_box[1]),
        min(img.width, crop_box[2]),
        min(img.height, crop_box[3])
    )
    
    cropped_img = img.crop(crop_box)
    
    return cropped_img


def save_image(image, filepath, format='JPEG', quality=95):
    """
    Save PIL Image to file
    
    Args:
        image (PIL.Image): Image object to save
        filepath (str): Destination file path
        format (str): Image format (JPEG, PNG, WEBP)
        quality (int): Quality for lossy formats
    """
    # Ensure RGB mode for JPEG
    if format.upper() == 'JPEG' and image.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode == 'P':
            image = image.convert('RGBA')
        background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
        image = background
    
    save_kwargs = {'format': format}
    
    if format.upper() in ('JPEG', 'WEBP'):
        save_kwargs['quality'] = quality
        save_kwargs['optimize'] = True
    elif format.upper() == 'PNG':
        save_kwargs['optimize'] = True
    
    image.save(filepath, **save_kwargs)
