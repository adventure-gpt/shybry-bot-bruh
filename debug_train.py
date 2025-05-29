#!/usr/bin/env python3
"""
debug_train.py

Loads your data, skips any unreadable files, logs dataset shapes,
builds a minimal EfficientNetV2-L model, and runs one epoch of training.
"""
import os, sys, logging

# Suppress oneDNN/CPU instr warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications.efficientnet_v2 import EfficientNetV2L, preprocess_input

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

def main():
    logging.info("Python %s", sys.version.replace("\n"," "))
    logging.info("TensorFlow %s", tf.__version__)
    logging.info("GPUs: %s", tf.config.list_physical_devices('GPU'))

    data_dir = "data"
    target_size = (480, 480)
    batch_size = 32

    # 1) Load dataset
    logging.info("Loading train dataset from %r", data_dir)
    train_ds = tf.keras.preprocessing.image_dataset_from_directory(
        data_dir,
        labels="inferred",
        label_mode="int",
        batch_size=batch_size,
        image_size=target_size,
        shuffle=True
    )
    logging.info("Found %d classes: %s", len(train_ds.class_names), train_ds.class_names)

    # 2) Skip any bad files
    train_ds = train_ds.ignore_errors()
    try:
        # 3) Inspect a single batch
        for imgs, lbls in train_ds.take(1):
            logging.info("  batch images.shape = %s", imgs.shape)
            logging.info("  batch labels.shape = %s", lbls.shape)
    except Exception as e:
        logging.error("Still failed to load first batch: %s", e)
        return

    # 4) Build a minimal model
    inp = layers.Input(shape=target_size + (3,), name="input_image")
    x = layers.Lambda(preprocess_input, name="preprocess")(inp)
    x = EfficientNetV2L(include_top=False, weights="imagenet")(x)
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    out = layers.Dense(len(train_ds.class_names), activation="softmax", name="predictions")(x)
    model = models.Model(inputs=inp, outputs=out, name="debug_efficientnetv2l")
    model.summary(print_fn=lambda s: logging.info(s))

    # 5) Compile & train one epoch
    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )
    logging.info("Training for 1 epoch (debug)...")
    history = model.fit(train_ds, epochs=1)
    logging.info("History: %s", history.history)

    # 6) Save debug model
    model.save("debug_model.keras")
    logging.info("Saved debug_model.keras")

if __name__ == "__main__":
    main()
