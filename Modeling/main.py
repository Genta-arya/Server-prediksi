import cv2
import sys
import os

def measure_leaf_area(image_path, pixels_per_cm=42):
    # Definisikan warna
    black = (0, 0, 0)
    green = (0, 255, 0)
    red = (0, 0, 255)
    white = (255, 255, 255)

    # Baca dan proses gambar
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 93, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    leaf_contour = max(contours, key=cv2.contourArea)

    # Hitung bounding box dan ukurannya
    x, y, w, h = cv2.boundingRect(leaf_contour)
    width_cm, height_cm = w / pixels_per_cm, h / pixels_per_cm
    bounding_box_area_cm2 = width_cm * height_cm

    # Gambar kontur, bounding box, dan garis ukuran
    cv2.drawContours(image, [leaf_contour], -1, green, 4)
    cv2.rectangle(image, (x, y), (x + w, y + h), red, 4)
    cv2.line(image, (x, y), (x, y + h), red, 4)
    cv2.line(image, (x, y + h), (x + w, y + h), red, 4)

    # Tambahkan teks informasi
    area_text = f'Luas: {bounding_box_area_cm2:.2f} cm²'
    width_text = f'Lebar: {width_cm:.2f} cm'
    height_text = f'Tinggi: {height_cm:.2f} cm'

    # Atur posisi teks di tepi bawah gambar
    font_scale = min(image.shape[0], image.shape[1]) / 1000
    font_thickness = max(1, int(font_scale * 2))

    text_line_spacing = int(30 * font_scale)
    text_bottom = image.shape[0] - int(20 * font_scale)
    text_left = int(10 * font_scale)

    # Tulis teks pada gambar dengan ukuran yang sesuai
    cv2.putText(image, area_text, (text_left, text_bottom - 2 * text_line_spacing),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale, white, font_thickness, cv2.LINE_AA)
    cv2.putText(image, width_text, (text_left, text_bottom - text_line_spacing),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale, white, font_thickness, cv2.LINE_AA)
    cv2.putText(image, height_text, (text_left, text_bottom),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale, white, font_thickness, cv2.LINE_AA)

    # Ubah ukuran gambar menjadi persegi kecil
    target_size = 500
    original_height, original_width = image.shape[:2]
    new_width, new_height = target_size, target_size
    padding_x, padding_y = 0, 0

    if original_height > original_width:
        new_height = target_size
        new_width = int(target_size * original_width / original_height)
        padding_x = (target_size - new_width) // 2
    else:
        new_width = target_size
        new_height = int(target_size * original_height / original_width)
        padding_y = (target_size - new_height) // 2

    resized_image = cv2.resize(image, (new_width, new_height))
    squared_image = cv2.copyMakeBorder(resized_image, padding_y, padding_y, padding_x, padding_x, cv2.BORDER_CONSTANT, value=[255, 255, 255])

    # Menentukan nama dan path file output
    base, ext = os.path.splitext(image_path)
    output_image_path = f'{base}_output{ext}'

    # Simpan hasil gambar ke file sementara dan output hasil ukuran
    cv2.imwrite(output_image_path, squared_image)
    
    # Print results for debugging
    print(f'{bounding_box_area_cm2},{width_cm},{height_cm},{output_image_path}')

def main(image_paths):
    for image_path in image_paths:
        measure_leaf_area(image_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <image_path1> <image_path2> ...")
        sys.exit(1)
    image_paths = sys.argv[1:]
    main(image_paths)
