#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Usage:
    python test.py --data_dir data --model_path models/best_advanced.pth [--num_samples 9 --display]
"""
import argparse
from pathlib import Path

import torch
import timm
from torchvision import transforms
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader
from sklearn.metrics import classification_report
import random

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--data_dir',    type=Path, required=True)
    p.add_argument('--model_path',  type=Path, required=True)
    p.add_argument('--batch_size',  type=int, default=32)
    p.add_argument('--num_samples', type=int, default=0,
                   help='if >0, display that many random samples')
    p.add_argument('--display', action='store_true',
                   help='print sample-by-sample predictions')
    return p.parse_args()

@torch.no_grad()
def main():
    args = parse_args()
    ckpt = torch.load(args.model_path, map_location='cpu')
    classes = ckpt['classes']
    num_classes = len(classes)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'

    model = timm.create_model("efficientnetv2_s", pretrained=False, num_classes=num_classes)
    model.load_state_dict(ckpt['model_state'])
    model.to(device).eval()

    tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=(0.485,0.456,0.406),
                             std=(0.229,0.224,0.225)),
    ])
    ds = ImageFolder(args.data_dir, tf)
    dl = DataLoader(ds, batch_size=args.batch_size, shuffle=False)

    all_preds, all_labels = [], []
    for x,y in dl:
        x = x.to(device)
        logits = model(x)
        preds = logits.argmax(dim=1).cpu().tolist()
        all_preds.extend(preds)
        all_labels.extend(y.tolist())

    print("Classification report:")
    print(classification_report(all_labels, all_preds, target_names=classes, zero_division=0))

    if args.display and args.num_samples>0:
        idxs = random.sample(range(len(ds)), min(args.num_samples, len(ds)))
        for i in idxs:
            img, label = ds[i]
            pred = all_preds[i]
            print(f"[{i}] actual={classes[label]}  pred={classes[pred]}")

if __name__ == '__main__':
    main()
