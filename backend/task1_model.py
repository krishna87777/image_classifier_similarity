# task1_model.py
import torch
import torch.nn as nn
import timm
from torchvision import transforms
from PIL import Image
import re
from paddleocr import PaddleOCR
import os


class ShopClassifier:
    def __init__(self, model_path):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")

        try:
            self.model = timm.create_model("deit_tiny_patch16_224", pretrained=False)
            self.model.head = nn.Linear(self.model.head.in_features, 2)

            # Load with error handling
            checkpoint = torch.load(model_path, map_location=self.device)
            self.model.load_state_dict(checkpoint)
            self.model.to(self.device)
            self.model.eval()
        except Exception as e:
            raise RuntimeError(f"Failed to load model: {e}")

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])

    def extract_shop_names(self, image_path):
        """Extract shop names using PaddleOCR and regex"""
        try:
            if not hasattr(self, 'ocr_model'):
                self.ocr_model = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

            results = self.ocr_model.ocr(image_path)

            if not results or not results[0]:
                return []

            # Extract all text
            all_text = []
            for line in results[0]:
                text = line[1][0]
                all_text.append(text)

            # Join all text and apply regex patterns
            full_text = ' '.join(all_text)

            patterns = [
                r'\b[A-Z][a-z]+ (?:Shop|Store|Market|Cafe|Restaurant|Bar|Deli|Bakery)\b',
                r'\b(?:Shop|Store|Market|Cafe|Restaurant|Bar|Deli|Bakery) [A-Z][a-z]+\b',
                r'\b[A-Z]{2,}(?:\s+[A-Z]+)*\b',  # All caps words
                r'\b[A-Z][a-zA-Z]*\s+(?:SHOP|STORE|MARKET|CAFE|RESTAURANT|BAR)\b',
            ]

            found_names = []
            for pattern in patterns:
                matches = re.findall(pattern, full_text, re.IGNORECASE)
                found_names.extend(matches)

            # Remove duplicates and return unique names
            return list(set(found_names))

        except Exception as e:
            print(f"OCR extraction failed: {e}")
            return []

    def predict(self, image_path):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        try:
            img = Image.open(image_path).convert("RGB")
            img_tensor = self.transform(img).unsqueeze(0).to(self.device)

            with torch.no_grad():
                outputs = self.model(img_tensor)
                probs = torch.softmax(outputs, dim=1).cpu().numpy()[0]

            label = "shop" if probs[1] > probs[0] else "not_shop"
            confidence = float(probs[1] if label == "shop" else probs[0])

            result = {
                "label": label,
                "probability": confidence,
                "shop_prob": float(probs[1]),
                "not_shop_prob": float(probs[0])
            }

            # Add OCR if it's a shop
            if label == "shop":
                shop_names = self.extract_shop_names(image_path)
                result["shop_names"] = shop_names
            else:
                result["shop_names"] = []

            return result
        except Exception as e:
            raise RuntimeError(f"Prediction failed: {e}")




