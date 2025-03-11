from PIL import Image, ImageDraw
import os

def create_circular_icon(size, color="#4A90E2", output_path=""):
    # Create a new image with transparency
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Draw a circle
    draw.ellipse([0, 0, size-1, size-1], fill=color)
    
    # Save the image
    image.save(output_path, 'PNG')

def main():
    # Create logos directory if it doesn't exist
    os.makedirs('logos', exist_ok=True)
    
    # Define sizes and create icons
    sizes = [32, 64, 128, 192, 256, 512]
    for size in sizes:
        output_path = f'logos/logo-{size}.png'
        create_circular_icon(size, output_path=output_path)
        print(f'Created {output_path}')

if __name__ == '__main__':
    main() 