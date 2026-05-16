"""
Chuyen doi anh HEIC sang JPG.
Can cai dat: pip install pillow-heif Pillow
"""

import os
import sys
from pathlib import Path

from PIL import Image
import pillow_heif

pillow_heif.register_heif_opener()


def convert_single_file(heic_path, delete_original=False):
    heic_path = Path(heic_path)
    if not heic_path.exists():
        print(f"File khong ton tai: {heic_path}")
        return False

    jpg_path = heic_path.with_suffix(".jpg")

    try:
        image = Image.open(heic_path)
        image.convert("RGB").save(jpg_path, "JPEG", quality=95)
        print(f"[OK] {heic_path.name} -> {jpg_path.name}")

        if delete_original:
            os.remove(heic_path)
            print(f"     Da xoa file goc: {heic_path.name}")

        return True
    except Exception as e:
        print(f"[LOI] {heic_path.name}: {e}")
        return False


def convert_folder(delete_original=False):
    folder = Path(".")
    heic_files = list(folder.glob("*.heic")) + list(folder.glob("*.HEIC"))

    if not heic_files:
        print("Khong tim thay file HEIC nao trong thu muc hien tai.")
        return

    print(f"Tim thay {len(heic_files)} file HEIC. Dang chuyen doi...\n")

    for heic_path in heic_files:
        convert_single_file(heic_path, delete_original)

    print("\nHoan tat!")


if __name__ == "__main__":
    delete = "--delete" in sys.argv
    file_arg = None

    for i, arg in enumerate(sys.argv):
        if arg == "--file" and i + 1 < len(sys.argv):
            file_arg = sys.argv[i + 1]

    if delete:
        print("CANH BAO: Se xoa file HEIC goc sau khi chuyen doi!\n")

    if file_arg:
        convert_single_file(file_arg, delete_original=delete)
    else:
        convert_folder(delete_original=delete)
