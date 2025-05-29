#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Usage:
    python train.py \
        --data_dir data \
        --val_dir data \
        --epochs 10 \
        --batch_size 32 \
        --lr 1e-3 \
        --output models/best_advanced.pth
"""

import argparse
import os
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import timm
from sklearn.metrics import classification_report

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--data_dir',     type=Path, required=True,
                   help='root of train dataset (subfolders per class)')
    p.add_argument('--val_dir',      type=Path, default=None,
                   help='root of val dataset (if None, uses data_dir)')
    p.add_argument('--epochs',       type=int, default=10)
    p.add_argument('--batch_size',   type=int, default=32)
    p.add_argument('--lr',           type=float, default=1e-3)
    p.add_argument('--output',       type=Path, required=True,
                   help='where to save best model (.pth)')
    return p.parse_args()

def make_loaders(train_dir, val_dir, bs):
    tf_train = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize(mean=(0.485,0.456,0.406),
                             std=(0.229,0.224,0.225)),
    ])
    tf_val = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=(0.485,0.456,0.406),
                             std=(0.229,0.224,0.225)),
    ])
    train_ds = datasets.ImageFolder(train_dir, tf_train)
    val_ds   = datasets.ImageFolder(val_dir,   tf_val)
    return (DataLoader(train_ds, batch_size=bs, shuffle=True,  num_workers=4, pin_memory=True),
            DataLoader(val_ds,   batch_size=bs, shuffle=False, num_workers=4, pin_memory=True),
            train_ds.classes)

def train_one_epoch(model, loader, crit, opt, device):
    model.train()
    total_loss = 0.
    for x,y in loader:
        x,y = x.to(device), y.to(device)
        opt.zero_grad()
        logits = model(x)
        loss = crit(logits, y)
        loss.backward()
        opt.step()
        total_loss += loss.item() * x.size(0)
    return total_loss / len(loader.dataset)

@torch.no_grad()
def validate(model, loader, device):
    model.eval()
    all_preds, all_labels = [], []
    for x,y in loader:
        x = x.to(device)
        logits = model(x)
        preds = logits.argmax(dim=1).cpu().tolist()
        all_preds.extend(preds)
        all_labels.extend(y.tolist())
    return all_preds, all_labels

def main():
    args = parse_args()
    train_dir = args.data_dir
    val_dir   = args.val_dir or args.data_dir

    print(f"Loading data: train={train_dir}  val={val_dir}")
    train_loader, val_loader, classes = make_loaders(train_dir, val_dir, args.batch_size)
    num_classes = len(classes)
    print("Classes:", classes)

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print("Using device:", device)

    print("Building model…")
    # use proper timm name for pretrained weights
    model = timm.create_model("tf_efficientnetv2_s",    pretrained=True, num_classes=num_classes)
    model.to(device)

    crit = nn.CrossEntropyLoss()
    opt  = optim.AdamW(model.parameters(), lr=args.lr)

    best_acc = 0.
    for epoch in range(1, args.epochs+1):
        train_loss = train_one_epoch(model, train_loader, crit, opt, device)
        preds, labels = validate(model, val_loader, device)
        report = classification_report(labels, preds, target_names=classes, zero_division=0, output_dict=True)
        val_acc = report['accuracy']
        print(f"Epoch {epoch}/{args.epochs}  train_loss={train_loss:.4f}  val_acc={val_acc:.4f}")
        best_acc = val_acc

        torch.save({
            'model_state': model.state_dict(),
            'classes':     classes,
        }, args.output)
        print("  → new best saved.")

    print("Training complete. Best val_acc:", best_acc)

if __name__ == '__main__':
    main()
