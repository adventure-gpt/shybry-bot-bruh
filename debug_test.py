#!/usr/bin/env python3
"""
debug_test.py

Loads a trained model, samples up to N images from your `data/` tree,
runs inference, and logs true vs. predicted labels for a handful.
"""
import os, sys, logging, argparse, random
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input

# Suppress oneDNN/CPU instr warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model_path", default="models/best_advanced.keras",
                   help="Path to your .keras model")
    p.add_argument("--data_dir",   default="data",
                   help="Root directory of your class subfolders")
    p.add_argument("--max_samples", type=int, default=200,
                   help="How many total images to load before stopping")
    p.add_argument("--num_samples", type=int, default=9,
                   help="How many to log/display")
    args = p.parse_args()

    logging.info("Python %s", sys.version.replace("\n"," "))
    logging.info("TensorFlow %s", tf.__version__)
    logging.info("Loading model from %r", args.model_path)
    model = tf.keras.models.load_model(args.model_path)
    model.summary(print_fn=lambda s: logging.info(s))

    # Derive target size from the model's input layer
    _, h, w, _ = model.input_shape
    target_size = (h, w)
    logging.info("Resizing all test images to %s", target_size)

    # Gather classes
    classes = sorted([d for d in os.listdir(args.data_dir)
                      if os.path.isdir(os.path.join(args.data_dir, d))])
    logging.info("Classes: %s", classes)

    # Gather up to max_samples valid image paths
    all_files = []
    for cls in classes:
        cls_dir = os.path.join(args.data_dir, cls)
        for fn in os.listdir(cls_dir):
            if fn.lower().endswith((".jpg",".jpeg",".png","bmp","gif")):
                all_files.append((os.path.join(cls_dir,fn), cls))
    random.shuffle(all_files)
    subset = all_files[: args.max_samples]

    # Load & preprocess
    imgs, true = [], []
    for fp, cls in subset:
        try:
            img = image.load_img(fp, target_size=target_size)
            arr = image.img_to_array(img)
            arr = preprocess_input(arr)
            imgs.append(arr)
            true.append(classes.index(cls))
        except Exception as e:
            logging.warning("Skipping bad file %r: %s", fp, e)
    X = np.stack(imgs, 0)
    y = np.array(true)
    logging.info("Prepared %d images for inference", len(X))

    # Predict
    preds = model.predict(X, verbose=0)
    yhat = preds.argmax(axis=1)

    # Log first num_samples comparisons
    for i in range(min(args.num_samples, len(X))):
        filename = os.path.basename(subset[i][0])
        logging.info("  %s → true=%-9s  pred=%s",
                     filename, classes[y[i]], classes[yhat[i]])

if __name__ == "__main__":
    main()
