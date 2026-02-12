
import sys
from PIL import Image
import os

def remove_background(input_path, output_path):
    print(f"Processing {input_path}...")
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # Simple heuristic: assuming the background is dark/black and pattern is light/white
            # Or vice versa. Let's assume user wants the "pattern" kept.
            # If the image is typical batik, it might be white wax on black/brown dye.
            # We'll use luminance to set alpha.
            # Formula for luminance: 0.299*R + 0.587*G + 0.114*B
            brightness = (0.299 * item[0] + 0.587 * item[1] + 0.114 * item[2])
            
            # If brightness is low (dark), make it transparent.
            # If brightness is high (light), keep it opaque (white).
            # We'll set the RGB to white (255, 255, 255) and Alpha to the brightness.
            
            # Use a threshold to clear out "almost black" noise
            if brightness < 50:
                alpha = 0
            else:
                # Scale alpha for visibility
                alpha = min(255, int(brightness * 1.5)) 
                
            newData.append((255, 255, 255, alpha))

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Successfully saved to {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    input_file = "/Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/frontend/public/assets/content/batik.jpg"
    output_file = "/Applications/XAMPP/xamppfiles/htdocs/Client_Project/BookingProject/frontend/public/assets/content/batik-transparent.png"
    
    if os.path.exists(input_file):
        remove_background(input_file, output_file)
    else:
        print(f"File not found: {input_file}")
