#!/usr/bin/env python3
import os
# suppress oneDNN warnings
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import argparse
import math
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
import matplotlib.pyplot as plt

def main():
    parser = argparse.ArgumentParser(
        description="Load a model, predict on a few images and display them."
    )
    parser.add_argument(
        "--model",
        type=str,
        default="models/best_advanced.keras",
        help="Path to your saved Keras model."
    )
    parser.add_argument(
        "--test_dir",
        type=str,
        default="data",
        help="Root folder of test images (subfolders = classes)."
    )
    parser.add_argument(
        "--num_samples",
        type=int,
        default=9,
        help="How many images (total) to display."
    )
    args = parser.parse_args()

    # 1) Load model
    print(f"Loading model from `{args.model}`…")
    model = tf.keras.models.load_model(args.model, compile=False)

    # 2) Determine class names by folder listing
    class_names = sorted([
        d for d in os.listdir(args.test_dir)
        if os.path.isdir(os.path.join(args.test_dir, d))
    ])
    print("Detected classes:", class_names)

    # 3) Gather up to num_samples image paths
    img_paths = []
    for cls in class_names:
        cls_dir = os.path.join(args.test_dir, cls)
        for fname in sorted(os.listdir(cls_dir)):
            if fname.lower().endswith((".png", ".jpg", ".jpeg", ".bmp", ".gif")):
                img_paths.append(os.path.join(cls_dir, fname))
    img_paths = img_paths[: args.num_samples]
    if not img_paths:
        print("No images found in", args.test_dir)
        return

    # 4) Load & preprocess images
    target_size = tuple(model.input_shape[1:3])
    imgs = []
    for p in img_paths:
        img = image.load_img(p, target_size=target_size)
        arr = image.img_to_array(img) / 255.0
        imgs.append(arr)
    batch = np.stack(imgs, axis=0)

    # 5) Predict
    preds = model.predict(batch, verbose=0)
    preds = np.argmax(preds, axis=1)

    # 6) Display grid
    n = len(batch)
    cols = int(math.ceil(math.sqrt(n)))
    plt.figure(figsize=(cols * 3, cols * 3))
    for i, img_arr in enumerate(batch):
        ax = plt.subplot(cols, cols, i + 1)
        plt.imshow(img_arr)
        plt.title(f"Pred: {class_names[preds[i]]}")
        plt.axis("off")
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()
